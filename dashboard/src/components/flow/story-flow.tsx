"use client";

import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MarkerType,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import { StartNode, type StartNodeData } from "./start-node";
import { StoryNode, type StoryNodeData } from "./story-node";
import { EndNode, type EndNodeData } from "./end-node";
import type { Story, StoryStatus } from "@/lib/types";
import type { RalphStatus } from "@/lib/store";
import { StoryDetailPanel } from "./story-detail-panel";

const nodeTypes: NodeTypes = {
  startNode: StartNode,
  storyNode: StoryNode,
  endNode: EndNode,
};

// Layout constants
const NODE_WIDTH = 280;
const NODE_HEIGHT = 80;
const START_NODE_WIDTH = 320;
const START_NODE_HEIGHT = 200;
const END_NODE_HEIGHT = 100;

// Serpentine layout: nodes zigzag across the canvas
// Row 0: start node (centered)
// Row 1+: story nodes in zigzag pattern (2-3 per row, alternating left/right)
const COLS = 2; // nodes per row
const H_SPACING = 360; // horizontal gap between columns
const V_SPACING = 160; // vertical gap between rows
const JITTER_X = 30; // random-ish x offset for organic feel
const JITTER_Y = 20; // random-ish y offset

// Deterministic "random" offset based on index (so layout doesn't jump on re-render)
function jitter(index: number, maxX: number, maxY: number) {
  const seed = ((index * 7 + 13) * 17) % 100;
  const xOff = ((seed % maxX) - maxX / 2);
  const yOff = (((seed * 3) % maxY) - maxY / 2);
  return { xOff, yOff };
}

// Compute serpentine positions for story nodes
function computeLayout(storyCount: number) {
  const positions: { x: number; y: number }[] = [];

  // Start node position (top center)
  const startX = (COLS - 1) * H_SPACING / 2;
  const startY = 0;
  const startPos = { x: startX, y: startY };

  let y = startY + START_NODE_HEIGHT + V_SPACING;
  let direction = 1; // 1 = left-to-right, -1 = right-to-left (serpentine)

  for (let i = 0; i < storyCount; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    // Serpentine: even rows go left→right, odd rows go right→left
    const actualCol = direction > 0 ? col : (COLS - 1 - col);

    const { xOff, yOff } = jitter(i, JITTER_X, JITTER_Y);

    positions.push({
      x: actualCol * H_SPACING + xOff,
      y: y + yOff,
    });

    // Move to next row when current row is full
    if (col === COLS - 1) {
      y += NODE_HEIGHT + V_SPACING;
      direction *= -1; // reverse direction for next row
    }
  }

  // End node: below the last story node, centered
  const endY = y + (storyCount % COLS === 0 ? 0 : NODE_HEIGHT + V_SPACING);
  const endPos = { x: startX, y: endY };

  return { startPos, positions, endPos };
}

// Determine edge connection handles based on relative positions
function getEdgeHandles(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number }
): { sourceHandle: string; targetHandle: string } {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;

  // Primarily vertical (same column or close)
  if (Math.abs(dx) < H_SPACING * 0.4) {
    return { sourceHandle: "bottom", targetHandle: "top" };
  }

  // Target is to the right
  if (dx > 0) {
    // If also significantly below, go bottom→left-target
    if (dy > V_SPACING * 0.5) {
      return { sourceHandle: "right-source", targetHandle: "left-target" };
    }
    return { sourceHandle: "right-source", targetHandle: "left-target" };
  }

  // Target is to the left
  if (dy > V_SPACING * 0.5) {
    return { sourceHandle: "left-source", targetHandle: "right-target" };
  }
  return { sourceHandle: "left-source", targetHandle: "right-target" };
}

export interface StoryFlowProps {
  stories: Story[];
  projectName: string;
  description: string;
  branchName?: string;
  ralphStatus: RalphStatus;
  iteration?: number;
  totalIterations?: number;
  currentStoryId?: string;
  readOnly?: boolean;
  onStoryNodeClick?: (story: Story) => void;
}

function getStoryStatus(
  story: Story,
  currentStoryId?: string,
  ralphStatus?: RalphStatus
): StoryStatus {
  if (story.status) return story.status;
  if (story.passes) return "completed";
  if (story.id === currentStoryId && ralphStatus === "running") return "running";
  return "pending";
}

export function StoryFlow({
  stories,
  projectName,
  description,
  branchName,
  ralphStatus,
  iteration,
  totalIterations,
  currentStoryId,
  readOnly = false,
  onStoryNodeClick,
}: StoryFlowProps) {
  const sortedStories = useMemo(
    () => [...stories].sort((a, b) => a.priority - b.priority),
    [stories]
  );

  const completedCount = useMemo(
    () => stories.filter((s) => s.passes).length,
    [stories]
  );

  const { nodes, edges } = useMemo(() => {
    const builtNodes: Node[] = [];
    const builtEdges: Edge[] = [];

    const layout = computeLayout(sortedStories.length);

    // Start node
    const startNodeData: StartNodeData = {
      projectName,
      description,
      completedCount,
      totalCount: stories.length,
      ralphStatus: readOnly ? "idle" : ralphStatus,
      branchName,
      iteration,
      totalIterations,
    };

    builtNodes.push({
      id: "start",
      type: "startNode",
      position: layout.startPos,
      data: startNodeData as unknown as Record<string, unknown>,
      draggable: true,
    });

    // Story nodes
    let firstStartedAt: string | undefined;
    let lastCompletedAt: string | undefined;

    // Build a position map for edge handle computation
    const posMap: Record<string, { x: number; y: number }> = {
      start: layout.startPos,
      end: layout.endPos,
    };

    sortedStories.forEach((story, index) => {
      const status = getStoryStatus(story, currentStoryId, ralphStatus);
      const pos = layout.positions[index];
      posMap[story.id] = pos;

      if (story.startedAt) {
        if (!firstStartedAt || story.startedAt < firstStartedAt) {
          firstStartedAt = story.startedAt;
        }
      }
      if (story.completedAt) {
        if (!lastCompletedAt || story.completedAt > lastCompletedAt) {
          lastCompletedAt = story.completedAt;
        }
      }

      const storyNodeData: StoryNodeData = {
        storyId: story.id,
        title: story.title,
        status: readOnly ? (story.passes ? "completed" : "pending") : status,
        startedAt: story.startedAt,
        completedAt: story.completedAt,
      };

      builtNodes.push({
        id: story.id,
        type: "storyNode",
        position: pos,
        data: storyNodeData as unknown as Record<string, unknown>,
        draggable: true,
      });

      // Edge from previous node
      const sourceId = index === 0 ? "start" : sortedStories[index - 1].id;
      const sourcePos = posMap[sourceId];
      const { sourceHandle, targetHandle } = getEdgeHandles(sourcePos, pos);

      const isRunningEdge =
        !readOnly &&
        (status === "running" ||
          getStoryStatus(
            sortedStories[index - 1] ?? story,
            currentStoryId,
            ralphStatus
          ) === "running");

      builtEdges.push({
        id: `e-${sourceId}-${story.id}`,
        source: sourceId,
        target: story.id,
        sourceHandle,
        targetHandle,
        animated: !readOnly && isRunningEdge,
        style: {
          stroke: isRunningEdge ? "#C15F3C" : "#E0DDD5",
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isRunningEdge ? "#C15F3C" : "#E0DDD5",
        },
      });
    });

    // End node
    const endNodeData: EndNodeData = {
      completedCount,
      totalCount: stories.length,
      firstStartedAt,
      lastCompletedAt,
    };

    builtNodes.push({
      id: "end",
      type: "endNode",
      position: layout.endPos,
      data: endNodeData as unknown as Record<string, unknown>,
      draggable: true,
    });

    // Edge from last story to end
    if (sortedStories.length > 0) {
      const lastStory = sortedStories[sortedStories.length - 1];
      const lastPos = posMap[lastStory.id];
      const { sourceHandle, targetHandle } = getEdgeHandles(lastPos, layout.endPos);

      builtEdges.push({
        id: `e-${lastStory.id}-end`,
        source: lastStory.id,
        target: "end",
        sourceHandle,
        targetHandle,
        animated: false,
        style: { stroke: "#E0DDD5", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#E0DDD5",
        },
      });
    }

    return { nodes: builtNodes, edges: builtEdges };
  }, [
    sortedStories,
    stories,
    projectName,
    description,
    branchName,
    ralphStatus,
    iteration,
    totalIterations,
    currentStoryId,
    completedCount,
    readOnly,
  ]);

  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "storyNode") {
        const story = stories.find((s) => s.id === node.id);
        if (story) {
          setSelectedStory(story);
          setPanelOpen(true);
          if (onStoryNodeClick) onStoryNodeClick(story);
        }
      }
    },
    [stories, onStoryNodeClick]
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={1.5}
        panOnScroll
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={!readOnly}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#E0DDD5"
        />

      </ReactFlow>
      <StoryDetailPanel
        story={selectedStory}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        readOnly={readOnly}
      />
    </>
  );
}
