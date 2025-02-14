# Use an official Node runtime as a parent image
FROM node:18-slim

# Install Python 3 (and pip) so that your Python scripts can run.
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

COPY requirements.txt ./

# Install Node dependencies (use --production for production builds)
RUN npm install --production

# Copy the rest of the application code to the container
COPY . .

# Expose the port your app runs on (adjust if necessary)
EXPOSE 3000

# Define the command to run your app (adjust as needed)
CMD ["npm", "start"]
