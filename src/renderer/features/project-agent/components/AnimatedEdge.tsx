import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';
import React from 'react';

export const AnimatedEdge: React.FC<EdgeProps> = ({
    // id is provided by react-flow but not used in render
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data
}) => {
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const isActive = data?.isActive as boolean;

    return (
        <>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    strokeWidth: 2,
                    stroke: 'hsl(var(--border))',
                }}
            />
            {isActive && (
                <BaseEdge
                    path={edgePath}
                    markerEnd={markerEnd}
                    style={{
                        ...style,
                        strokeWidth: 2,
                        stroke: 'hsl(var(--primary))',
                        strokeDasharray: '5,5',
                        animation: 'dashdraw 1s linear infinite',
                    }}
                    className="animated-edge-overlay"
                />
            )}
        </>
    );
};
