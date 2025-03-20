import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';

interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * A secure component to display message content with markdown formatting
 * Uses react-markdown for rendering and DOMPurify for sanitization
 */
const Markdown: React.FC<MarkdownProps> = ({ content, className = '' }) => {
  // Pre-process content before passing to markdown renderer
  const processContent = (text: string): string => {
    if (!text) return '';
    
    // Sanitize the input to prevent XSS attacks
    let sanitized = DOMPurify.sanitize(text);
    
    // Special handling for document references to highlight them
    sanitized = sanitized.replace(
      /Using document: ([^\n]+)/g,
      'Using document: **$1** 📄'
    );
    
    // Special handling for "Using X documents:" references
    sanitized = sanitized.replace(
      /(Using \d+ documents:) ([^\n]+)/g,
      '$1 **$2** 📄'
    );
    
    return sanitized;
  };
  
  // Custom link renderer to ensure security and styling
  const CustomLink = (props: any) => {
    const { href, children } = props;
    return (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-blue-500 hover:underline"
      >
        {children}
      </a>
    );
  };
  
  // Custom components for markdown elements
  const components = {
    a: CustomLink,
    // Style headings
    h1: ({ children }: any) => <h1 className="text-2xl font-bold my-3">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-xl font-bold my-2">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-lg font-bold my-2">{children}</h3>,
    // Style code blocks with syntax highlighting
    code: ({ node, inline, className, children, ...props }: any) => {
      return inline ? (
        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono" {...props}>
          {children}
        </code>
      ) : (
        <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto my-3">
          <code className="text-sm font-mono" {...props}>
            {children}
          </code>
        </pre>
      );
    },
    // Style blockquotes
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-1 my-2 text-gray-700 dark:text-gray-300 italic">
        {children}
      </blockquote>
    ),
    // Style lists
    ul: ({ children }: any) => <ul className="list-disc pl-6 my-2">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-6 my-2">{children}</ol>,
    // Style strong/bold text to highlight document references
    strong: ({ children }: any) => {
      // Check if this is a document reference
      const isDocRef = String(children).includes('document');
      return isDocRef ? (
        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 py-0.5 rounded font-medium">
          {children}
        </span>
      ) : (
        <strong className="font-bold">{children}</strong>
      );
    }
  };

  const processedContent = processContent(content);
  
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]} 
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default Markdown; 