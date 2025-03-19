#!/bin/bash

echo "🚀 Starting frontend..."

cd frontend
echo "📁 Working directory: $(pwd)"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found, installing dependencies..."
    npm install
    
    # Install Tailwind CSS dependencies
    echo "📦 Installing Tailwind CSS dependencies..."
    npm install -D tailwindcss@latest postcss@latest autoprefixer@latest
else
    echo "✅ node_modules found"
fi

# Check if types directory exists
if [ ! -d "src/types" ]; then
    echo "📁 Creating types directory for TypeScript definitions..."
    mkdir -p src/types
else
    echo "✅ Types directory found"
fi

# Create type definition file for react-icons
echo "📝 Creating/updating TypeScript definition for react-icons..."
cat > src/types/react-icons.d.ts << 'EOF'
import { ComponentType, SVGProps } from 'react';

declare module 'react-icons/fi' {
  export interface IconBaseProps extends SVGProps<SVGElement> {
    size?: string | number;
    color?: string;
    title?: string;
  }
  
  export type IconType = ComponentType<IconBaseProps>;
  
  export const FiPlus: IconType;
  export const FiMenu: IconType;
  export const FiX: IconType;
  export const FiTrash2: IconType;
  export const FiUser: IconType;
  export const FiZap: IconType;
  export const FiSend: IconType;
  export const FiSettings: IconType;
  export const FiKey: IconType;
  export const FiLogOut: IconType;
}
EOF

# Update PostCSS config
echo "📝 Updating PostCSS config..."
cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Update Tailwind config
echo "📝 Updating Tailwind config..."
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

echo "🚀 Starting frontend server..."
npm start 