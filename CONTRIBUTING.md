# Contributing to pdfchat.ai

Thank you for your interest in contributing to pdfchat.ai! This document provides guidelines and instructions for contributing to this project.

## Development Setup

1. Fork the repository and clone your fork:
   ```
   git clone https://github.com/YOUR_USERNAME/pdfchat.ai.git
   cd pdfchat.ai
   ```

2. Make sure all shell scripts are executable:
   ```
   chmod +x *.sh
   ```

3. Install dependencies:
   ```
   ./setup.sh
   ```

4. Start the application in development mode:
   ```
   npm run dev
   # or
   ./manage.sh dev
   ```

## Development Workflow

1. Create a new branch for your feature or bugfix:
   ```
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-you-are-fixing
   ```

2. Make your changes using the development mode for hot reloading:
   - Frontend changes will be applied instantly
   - Backend changes will trigger an automatic server restart

3. Test your changes thoroughly

4. Commit your changes following the commit message guidelines below

5. Push your branch and create a pull request

## Commit Message Guidelines

Please follow these guidelines for commit messages:

- Use the imperative mood ("Add feature" not "Added feature")
- First line should be 50 characters or less
- Reference issues with #issue-number
- Structure commit messages as follows:
  ```
  [component]: Brief description of change

  More detailed explanation if necessary.

  Refs #123
  ```

Example commit messages:
```
[frontend]: Add conversation title tooltip

Improve user experience by showing full conversation title on hover
in the sidebar to help users with long titles.

Refs #456
```

```
[backend]: Fix authentication token refresh logic

Prevent tokens from expiring prematurely by updating the refresh
mechanism to properly handle token lifetime.

Fixes #789
```

## Code Style Guidelines

### Python
- Follow PEP 8 style guide
- Use type annotations where possible
- Write docstrings for functions and classes

### JavaScript/TypeScript
- Use ES6+ features
- Follow the project's existing style (spacing, naming, etc.)
- Use TypeScript interfaces for props and state

## Testing

- Add tests for new features
- Ensure existing tests pass
- Run the application and test functionality manually

## Pull Request Process

1. Update the README.md with details of significant changes if applicable
2. Update any relevant documentation
3. The PR will be merged once it passes review and CI checks

## Questions?

If you have any questions about contributing, please open an issue for discussion.

Thank you for contributing to pdfchat.ai! 