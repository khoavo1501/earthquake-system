import React, { useState, useRef, useCallback } from 'react';

/**
 * HOC to add zoom functionality to Recharts charts
 * Supports mouse wheel zoom and Brush component for pan/zoom
 */
const ZoomableChart = ({ children, data }) => {
  const [zoomState, setZoomState] = useState({
    left: 0,
    right: data?.length || 100
  });
  
  const chartRef = useRef(null);

  const handleWheel = useCallback((e) => {
    if (!data || data.length === 0) return;
    
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1.1 : 0.9; // Zoom in/out factor
    
    const { left, right } = zoomState;
    const range = right - left;
    const newRange = Math.max(5, Math.min(data.length, range * delta));
    const center = (left + right) / 2;
    
    let newLeft = Math.max(0, center - newRange / 2);
    let newRight = Math.min(data.length, center + newRange / 2);
    
    // Adjust if we hit boundaries
    if (newLeft === 0) {
      newRight = Math.min(data.length, newRange);
    } else if (newRight === data.length) {
      newLeft = Math.max(0, data.length - newRange);
    }
    
    setZoomState({
      left: Math.floor(newLeft),
      right: Math.ceil(newRight)
    });
  }, [data, zoomState]);

  const handleBrushChange = useCallback((newState) => {
    if (newState) {
      setZoomState({
        left: newState.startIndex || 0,
        right: newState.endIndex || data?.length || 100
      });
    }
  }, [data]);

  return (
    <div 
      ref={chartRef}
      onWheel={handleWheel}
      style={{ cursor: 'zoom-in' }}
    >
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            startIndex: zoomState.left,
            endIndex: zoomState.right,
            onBrushChange: handleBrushChange
          });
        }
        return child;
      })}
    </div>
  );
};

export default ZoomableChart;
