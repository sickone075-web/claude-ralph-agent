"use client";

import { ReactFlow, Background, Controls } from "@xyflow/react";

const initialNodes = [
  {
    id: "1",
    position: { x: 0, y: 0 },
    data: { label: "ReactFlow Test Node" },
  },
];

export function ReactFlowTest() {
  return (
    <div style={{ width: "100%", height: 400 }}>
      <ReactFlow nodes={initialNodes} edges={[]}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
