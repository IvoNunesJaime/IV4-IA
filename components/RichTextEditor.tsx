import React from 'react';

// This component has been deprecated as per user request to remove the "Word" editor.
// It is kept as a placeholder to prevent build errors if lazy imports exist, 
// but it is no longer used in the main application flow.

export const RichTextEditor: React.FC<any> = () => {
  return <div className="p-4">Editor removido.</div>;
};
