import React, { useState, useCallback, useEffect } from 'react';

interface ResizerProps {
  onResize: (delta: number) => void;
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

const Resizer: React.FC<ResizerProps> = ({
  onResize,
  direction = 'horizontal',
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startPosition, setStartPosition] = useState(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartPosition(direction === 'horizontal' ? e.clientX : e.clientY);
  }, [direction]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const currentPosition = direction === 'horizontal' ? e.clientX : e.clientY;
    const delta = currentPosition - startPosition;
    
    if (delta !== 0) {
      onResize(delta);
      setStartPosition(currentPosition);
    }
  }, [isDragging, startPosition, direction, onResize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add and remove event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      // Prevent text selection during resizing
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Re-enable text selection
      document.body.style.userSelect = '';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      className={`group ${
        direction === 'horizontal'
          ? 'w-2 hover:w-3 cursor-col-resize'
          : 'h-2 hover:h-3 cursor-row-resize'
      } bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-all ${
        isDragging ? 'bg-blue-400 dark:bg-blue-600' : ''
      } ${className} flex items-center justify-center`}
      onMouseDown={handleMouseDown}
      style={{
        touchAction: 'none',
        zIndex: 10,
      }}
    >
      {/* Visual handle dots */}
      {direction === 'horizontal' ? (
        <div className="flex flex-col items-center space-y-1">
          <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-gray-600 dark:group-hover:bg-gray-400" />
          <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-gray-600 dark:group-hover:bg-gray-400" />
          <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-gray-600 dark:group-hover:bg-gray-400" />
        </div>
      ) : (
        <div className="flex flex-row items-center space-x-1">
          <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-gray-600 dark:group-hover:bg-gray-400" />
          <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-gray-600 dark:group-hover:bg-gray-400" />
          <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-gray-600 dark:group-hover:bg-gray-400" />
        </div>
      )}
    </div>
  );
};

export default Resizer; 