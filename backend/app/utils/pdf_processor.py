import fitz  # PyMuPDF
import os
import logging
import re
import html
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

class PDFProcessor:
    """
    Utility class for processing PDF files.
    Handles text extraction and searching within PDFs.
    """
    
    @staticmethod
    def sanitize_text(text: str) -> str:
        """
        Sanitize text to prevent injection attacks
        
        Args:
            text: Text to sanitize
            
        Returns:
            Sanitized text
        """
        if not text:
            return ""
            
        # Escape HTML entities to prevent script injection
        sanitized = html.escape(text)
        
        # Remove any potential markdown injection patterns that could lead to unintended rendering
        # Remove anything that looks like HTML comments or script tags that weren't caught by html.escape
        sanitized = re.sub(r'<!--.*?-->', '', sanitized)
        
        # Remove control characters except for basic whitespace
        sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', sanitized)
        
        return sanitized
    
    @staticmethod
    def extract_text_from_pdf(file_path: str) -> List[Dict[str, any]]:
        """
        Extract text from a PDF file, page by page
        
        Args:
            file_path: Path to the PDF file
            
        Returns:
            List of dictionaries with page number and text content
        """
        if not os.path.exists(file_path):
            logger.error(f"PDF file not found: {file_path}")
            return []
            
        try:
            # Open the PDF
            doc = fitz.open(file_path)
            pages = []
            
            # Extract text from each page
            for page_num, page in enumerate(doc):
                text = page.get_text()
                
                # Sanitize the extracted text
                sanitized_text = PDFProcessor.sanitize_text(text)
                
                if sanitized_text.strip():  # Only add non-empty pages
                    pages.append({
                        "page_number": page_num + 1,  # 1-indexed for user-friendliness
                        "content": sanitized_text
                    })
            
            return pages
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF {file_path}: {str(e)}")
            return []
    
    @staticmethod
    def get_document_summary(file_path: str, max_chars: int = 1000) -> str:
        """
        Get a short summary of the document contents for context provision
        
        Args:
            file_path: Path to the PDF file
            max_chars: Maximum number of characters to include
            
        Returns:
            String summary of document contents
        """
        try:
            pages = PDFProcessor.extract_text_from_pdf(file_path)
            if not pages:
                return "Document contains no extractable text."
            
            # Get document metadata where possible
            doc = fitz.open(file_path)
            metadata = doc.metadata
            
            # Sanitize metadata
            title = PDFProcessor.sanitize_text(metadata.get("title", os.path.basename(file_path)))
            author = PDFProcessor.sanitize_text(metadata.get("author", "Unknown author"))
            total_pages = len(doc)
            
            # Get beginning text (already sanitized by extract_text_from_pdf)
            first_pages_text = " ".join([p["content"] for p in pages[:2]])
            summary_text = first_pages_text[:max_chars].strip()
            
            if len(first_pages_text) > max_chars:
                summary_text += "..."
                
            # Format the summary
            summary = (
                f"Document: {title}\n"
                f"Author: {author}\n"
                f"Pages: {total_pages}\n\n"
                f"Content Preview:\n{summary_text}"
            )
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting document summary for {file_path}: {str(e)}")
            return f"Error: Could not generate document summary: {PDFProcessor.sanitize_text(str(e))}"
    
    @staticmethod
    def format_document_for_prompt(file_path: str, doc_name: str) -> Tuple[str, bool]:
        """
        Format document text for inclusion in an OpenAI prompt
        
        Args:
            file_path: Path to the PDF file
            doc_name: Name of the document
        
        Returns:
            Tuple of (formatted text, success flag)
        """
        try:
            # Extract text
            pages = PDFProcessor.extract_text_from_pdf(file_path)
            if not pages:
                return f"Document '{PDFProcessor.sanitize_text(doc_name)}' contains no extractable text.", False
            
            # Sanitize document name
            safe_doc_name = PDFProcessor.sanitize_text(doc_name)
            
            # Format the text with page numbers
            formatted_text = f"\n\n--- DOCUMENT: {safe_doc_name} ---\n\n"
            
            for page in pages:
                page_text = page["content"].strip()
                if page_text:
                    formatted_text += f"[Page {page['page_number']}]\n{page_text}\n\n"
            
            return formatted_text, True
            
        except Exception as e:
            logger.error(f"Error formatting document {file_path}: {str(e)}")
            return f"Error processing document '{PDFProcessor.sanitize_text(doc_name)}': {PDFProcessor.sanitize_text(str(e))}", False 