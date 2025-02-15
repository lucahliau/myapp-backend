# Use an official Node runtime as a parent image
FROM node:18-slim

# Install Python 3 and pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy only the dependency files first to leverage Docker caching
COPY package*.json ./
COPY requirements.txt ./

# Install Node dependencies (using npm ci is even faster if you have a lockfile)
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Define the command to run your app
CMD ["npm", "start"]
