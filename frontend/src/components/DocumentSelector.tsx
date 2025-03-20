import React, { useState, useRef, useEffect } from 'react';
import { FiFile, FiCheckSquare, FiSquare, FiChevronDown, FiChevronUp, FiSearch, FiX } from 'react-icons/fi';

interface Document {
  id: string | number;
  name: string;
  size?: number;
  url?: string;
}

interface DocumentSelectorProps {
  documents: Document[];
  onInsertReferences: (documentNames: string[]) => void;
  className?: string;
}

const DocumentSelector: React.FC<DocumentSelectorProps> = ({ 
  documents,
  onInsertReferences,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<string | number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      // Short delay to ensure the input is rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      // Clear search when dropdown closes
      setSearchTerm('');
    }
  }, [isOpen]);
  
  // Toggle document selection
  const toggleDocument = (docId: string | number, event?: React.MouseEvent) => {
    // Prevent closing the dropdown when clicking on a document
    if (event) {
      event.stopPropagation();
    }
    
    const newSelection = new Set(selectedDocs);
    if (newSelection.has(docId)) {
      newSelection.delete(docId);
    } else {
      newSelection.add(docId);
    }
    setSelectedDocs(newSelection);
  };
  
  // Toggle all filtered documents
  const toggleAllDocuments = () => {
    const filteredDocs = filterDocuments();
    const filteredIds = filteredDocs.map(doc => doc.id);
    
    // Check if all filtered documents are selected
    const allFiltered = filteredIds.every(id => selectedDocs.has(id));
    
    if (allFiltered) {
      // Remove only filtered documents from selection
      const newSelection = new Set(selectedDocs);
      filteredIds.forEach(id => newSelection.delete(id));
      setSelectedDocs(newSelection);
    } else {
      // Add all filtered documents to selection
      const newSelection = new Set(selectedDocs);
      filteredIds.forEach(id => newSelection.add(id));
      setSelectedDocs(newSelection);
    }
  };
  
  // Insert selected document references into chat
  const insertReferences = () => {
    // Get names of selected documents
    const selectedDocNames = documents
      .filter(doc => selectedDocs.has(doc.id))
      .map(doc => doc.name);
    
    if (selectedDocNames.length > 0) {
      onInsertReferences(selectedDocNames);
      
      // Close the selector and clear selection
      setIsOpen(false);
      setSelectedDocs(new Set());
      setSearchTerm('');
    }
  };
  
  // Filter documents based on search term
  const filterDocuments = () => {
    if (!searchTerm.trim()) {
      return documents;
    }
    
    const term = searchTerm.toLowerCase();
    return documents.filter(doc => 
      doc.name.toLowerCase().includes(term)
    );
  };
  
  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Clear search input
  const clearSearch = () => {
    setSearchTerm('');
    searchInputRef.current?.focus();
  };
  
  // Get filtered documents
  const filteredDocuments = filterDocuments();
  
  // Calculate the count of selected documents in filtered list
  const filteredSelectedCount = filteredDocuments.filter(doc => 
    selectedDocs.has(doc.id)
  ).length;
  
  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded border border-gray-300 dark:border-gray-700"
        disabled={documents.length === 0}
        title={documents.length === 0 ? "No documents available" : "Select documents to reference"}
      >
        <FiFile size={14} />
        <span className="text-sm">Add Document{selectedDocs.size > 0 ? ` (${selectedDocs.size})` : ''}</span>
        {isOpen ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
      </button>
      
      {isOpen && documents.length > 0 && (
        <div className="absolute left-0 bottom-full mb-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg z-10 w-72">
          {/* Header with title */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Reference Documents
              </h3>
              <button
                type="button"
                onClick={toggleAllDocuments}
                className="text-xs text-gray-700 dark:text-gray-300 hover:underline"
              >
                {filteredSelectedCount === filteredDocuments.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>
          
          {/* Search bar */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <FiSearch size={14} className="text-gray-400" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <FiX size={14} />
                </button>
              )}
            </div>
          </div>
          
          {/* Document list - scrollable */}
          <div className="max-h-60 overflow-y-auto">
            {filteredDocuments.length > 0 ? (
              <ul className="py-1">
                {filteredDocuments.map(doc => (
                  <li 
                    key={doc.id} 
                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={(e) => toggleDocument(doc.id, e)}
                  >
                    <div className="flex items-start space-x-2">
                      {/* Fixed width for checkbox container */}
                      <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                        {selectedDocs.has(doc.id) ? (
                          <FiCheckSquare className="text-black dark:text-white" size={16} />
                        ) : (
                          <FiSquare className="text-gray-500" size={16} />
                        )}
                      </div>
                      {/* Limited width for document name with ellipsis */}
                      <span className="text-sm text-gray-800 dark:text-gray-200 truncate max-w-[220px] flex-1">
                        {doc.name}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-4 px-3 text-center text-gray-500 dark:text-gray-400 text-sm">
                No documents match your search
              </div>
            )}
          </div>
          
          {/* Action button */}
          {selectedDocs.size > 0 && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={insertReferences}
                className="w-full px-3 py-1.5 bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black text-sm rounded"
              >
                Add {selectedDocs.size} {selectedDocs.size === 1 ? 'Document' : 'Documents'} to Chat
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentSelector; 