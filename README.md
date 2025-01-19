# Lottery Draw Application

A web application that displays a grid of participant photos and randomly selects a winner. Built with FastAPI and Bootstrap.

## Features

- Display grid of 70 participant photos with names
- Random winner selection
- Animated winner announcement
- Responsive design
- Docker support for deployment

## Prerequisites

- Python 3.11.2 or higher
- pip (Python package installer)
- Git (optional, for version control)

## Local Development Setup

### 1. Create Project Structure

```bash
# Create project directory
mkdir lottery-draw
cd lottery-draw

# Create directory structure
mkdir -p app/static/{css,js,images}
mkdir -p app/templates
mkdir -p app/data
```

### 2. Set Up Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
.\venv\Scripts\activate
```

### 3. Install Dependencies

Create a `requirements.txt` file with the following content:
```txt
fastapi==0.68.1
uvicorn==0.15.0
jinja2==3.0.1
aiofiles==0.7.0
```

Install the requirements:
```bash
pip install -r requirements.txt
```

### 4. Add Project Files

Create the following files in your project structure:

```
lottery-draw/
├── app/
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css
│   │   ├── js/
│   │   │   └── script.js
│   │   └── images/
│   │       └── [your participant images]
│   ├── templates/
│   │   └── index.html
│   ├── data/
│   │   └── participants.json
│   └── main.py
└── requirements.txt
```

### 5. Add Participant Data

1. Place participant photos in `app/static/images/`
2. Update `app/data/participants.json` with participant information:
```json
[
    {
        "name": "Participant 1",
        "photo": "participant1.jpg"
    },
    ...
]
```

### 6. Run the Application

```bash
# Make sure you're in the lottery-draw directory
cd app
uvicorn main:app --reload
```

The application will be available at `http://127.0.0.1:8000`

## Deployment to Zeabur

### 1. Prepare for Deployment

Create a `Dockerfile` in your project root:

```dockerfile
FROM python:3.11.2-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2. Deploy to Zeabur

1. Push your code to a GitHub repository
2. Log in to your Zeabur account
3. Create a new project
4. Add a new service and select your GitHub repository
5. Choose Docker as the deployment method
6. Configure the port to 8000
7. Deploy the service

## Detailed Deployment Guide to Zeabur

This section provides a step-by-step guide for deploying the lottery draw application to Zeabur.

### Step 1: Prepare Your Project

1. Verify your project structure matches exactly:
```
lottery-draw/
├── app/
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css
│   │   ├── js/
│   │   │   └── script.js
│   │   └── images/
│   │       └── [your participant photos]
│   ├── templates/
│   │   └── index.html
│   ├── data/
│   │   └── participants.json
│   └── main.py
├── Dockerfile
└── requirements.txt
```

2. Ensure your `requirements.txt` contains these exact versions:
```txt
fastapi==0.68.1
uvicorn==0.15.0
jinja2==3.0.1
aiofiles==0.7.0
```

### Step 2: Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in/create account
2. Click the "+" icon in top right corner
3. Select "New repository"
4. Fill in repository details:
   - Name: `lottery-draw`
   - Description: "Lottery Draw Application"
   - Make it Public
   - Don't initialize with README
5. Click "Create repository"

### Step 3: Push Code to GitHub

Open terminal in your project directory and run:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit"

# Add GitHub repository as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/lottery-draw.git

# Push code
git push -u origin main
```

### Step 4: Deploy to Zeabur

1. Sign up/sign in at [Zeabur](https://zeabur.com)

2. Create new project:
   - Click "Create Project"
   - Name it "lottery-draw"

3. Add service:
   - Click "Add Service"
   - Select "Deploy from Source"
   - Choose GitHub
   - Select your `lottery-draw` repository
   - If repository not visible:
     - Click "Configure GitHub"
     - Grant repository access

4. Configure deployment:
   - Service Name: "lottery-draw"
   - Build Method: Choose "Dockerfile"
   - Port: Enter "8000"
   - Environment Variables: None needed for basic setup

5. Click "Deploy" and wait for build completion

### Step 5: Verify Deployment

1. Access provided Zeabur domain
2. Test all functionality:
   - Image loading
   - Draw button
   - Winner display
   - Database operations

### Troubleshooting Deployment Issues

1. **Images not loading:**
   - Verify images in Docker image:
     ```bash
     docker build -t lottery-draw .
     docker run -it lottery-draw ls /app/static/images
     ```
   - Check image paths in `participants.json`
   - Verify file permissions

2. **Application not starting:**
   - Check Zeabur logs in service dashboard
   - Verify port configuration (must be 8000)
   - Check environment variables

3. **Database issues:**
   - Verify SQLite write permissions
   - Check logs for permission errors
   - Ensure database path is correct

4. **Deployment failures:**
   - Verify all files committed to GitHub
   - Check Dockerfile syntax
   - Review build logs in Zeabur dashboard

### Updating Deployed Application

1. Make local changes
2. Commit and push to GitHub:
```bash
git add .
git commit -m "Description of changes"
git push
```
3. Zeabur will automatically detect and redeploy

### Important Notes

1. **Database Persistence:**
   - SQLite database is created on first run
   - Data persists between deployments
   - Use reset function to clear data

2. **Security Considerations:**
   - Keep `DEBUG` mode off in production
   - Don't expose sensitive data in logs
   - Regularly update dependencies

3. **Performance:**
   - Optimize image sizes
   - Enable caching in production
   - Monitor application logs

4. **Backup:**
   - Regularly backup your database
   - Keep copy of participant data
   - Document any custom configurations

For additional support or questions, please create an issue in the GitHub repository.

## Troubleshooting

### Common Issues

1. **Images not displaying**
   - Verify image files are in `app/static/images/`
   - Check file names match entries in `participants.json`
   - Check browser console for 404 errors

2. **Server won't start**
   - Ensure virtual environment is activated
   - Verify all requirements are installed
   - Check you're in the correct directory

3. **Winner modal not appearing**
   - Check browser console for JavaScript errors
   - Verify Bootstrap files are loading correctly

### Development Tips

- Use `--reload` flag with uvicorn for auto-reloading during development
- Access API documentation at `http://127.0.0.1:8000/docs`
- Use browser developer tools to debug frontend issues

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and feature requests, please create an issue in the GitHub repository.
```
