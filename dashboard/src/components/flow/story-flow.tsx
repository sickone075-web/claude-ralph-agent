"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import { StartNode, type StartNodeData } from "./start-node";
import { StoryNode, type StoryNodeData } from "./story-node";
import { EndNode, type EndNodeData } from "./end-node";
import type { Story, StoryStatus } from "@/lib/types";
import type { RalphStatus } from "@/lib/store";

const nodeTypes: NodeTypes = {
  startNode: StartNode,
  storyNode: StoryNode,
  endNode: EndNode,
};

// Node heights (approximate) and gap
const START_NODE_HEIGHT = 200;
const STORY_NODE_HEIGHT = 80;
const END_NODE_HEIGHT = 100;
const NODE_GAP = 100;

// Center x offset so nodes are centered (start node is widest at 320px)
const CENTER_X = 20; // offset so 280px story nodes center under 320px start node

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
    let yOffset = 0;

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
      position: { x: 0, y: yOffset },
      data: startNodeData as unknown as Record<string, unknown>,
      draggable: false,
    });

    yOffset += START_NODE_HEIGHT + NODE_GAP;

    // Story nodes
    let firstStartedAt: string | undefined;
    let lastCompletedAt: string | undefined;

    sortedStories.forEach((story, index) => {
      const status = getStoryStatus(story, currentStoryId, ralphStatus);

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
        position: { x: CENTER_X, y: yOffset },
        data: storyNodeData as unknown as Record<string, unknown>,
        draggable: false,
      });

      // Edge from previous node
      const sourceId = index === 0 ? "start" : sortedStories[index - 1].id;
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
        animated: !readOnly && isRunningEdge,
        style: {
          stroke: isRunningEdge ? "#06B6D4" : "#3f3f46",
          strokeWidth: 2,
        },
      });

      yOffset += STORY_NODE_HEIGHT + NODE_GAP;
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
      position: { x: CENTER_X, y: yOffset },
      data: endNodeData as unknown as Record<string, unknown>,
      draggable: false,
    });

    // Edge from last story to end
    if (sortedStories.length > 0) {
      const lastStory = sortedStories[sortedStories.length - 1];
      builtEdges.push({
        id: `e-${lastStory.id}-end`,
        source: lastStory.id,
        target: "end",
        animated: false,
        style: { stroke: "#3f3f46", strokeWidth: 2 },
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

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "storyNode" && onStoryNodeClick) {
        const story = stories.find((s) => s.id === node.id);
        if (story) onStoryNodeClick(story);
      }
    },
    [stories, onStoryNodeClick]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.3}
      maxZoom={1.5}
      panOnScroll
      zoomOnScroll
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={!readOnly}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="#27272a"
      />
    </ReactFlow>
  );
}
