FROM node:20 AS build

# Set working directory for the backend
WORKDIR /safemaps_combined/back

# Copy package.json and package-lock.json for frontend
COPY ./package.json ./package-lock.json ./

# Copy backend source code
COPY . .

# Install backend dependencies
RUN npm install

# Expose port for backend (if needed)
EXPOSE 3000

# Command to run backend server (adjust as per your backend setup)
CMD ["node", "fetchCrimeData.js"]
