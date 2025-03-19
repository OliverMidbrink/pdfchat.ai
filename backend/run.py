import sys
import importlib
import uvicorn

def check_dependencies():
    """Check if all required dependencies are installed."""
    required_packages = [
        ('fastapi', 'fastapi'),
        ('uvicorn', 'uvicorn'),
        ('sqlalchemy', 'sqlalchemy'),
        ('pydantic', 'pydantic'),
        ('passlib', 'passlib'),
        ('python-jose', 'jose'),
        ('python-multipart', 'multipart'),
        ('bcrypt', 'bcrypt'),
    ]
    
    missing_packages = []
    
    for package_name, import_name in required_packages:
        try:
            importlib.import_module(import_name)
        except ImportError:
            missing_packages.append(package_name)
    
    if missing_packages:
        print("❌ Error: The following required packages are missing:")
        for package in missing_packages:
            print(f"  - {package}")
        print("\nPlease install the missing packages with:")
        print("pip install -r requirements.txt")
        return False
    
    return True

def main():
    """Main function to run the FastAPI application."""
    if not check_dependencies():
        sys.exit(1)
        
    print("✅ All dependencies verified!")
    print("🚀 Starting FastAPI server...")
    
    try:
        uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
    except Exception as e:
        print(f"❌ Error starting server: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 