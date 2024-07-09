# SafeMap

#Overview

SafeMap is a SaaS application designed to recommend the safest and fastest route between an origin and a destination using crime statistics. It leverages real-time data ingestion from various sources and advanced technologies to ensure users can navigate safely.

#Features

Route Recommendation: Get the safest and fastest routes based on real-time crime statistics.

Geocoded Crime Database: Built with data from SpotcrimeAPI, Yahoo News, and user uploads.


Robust Backend: Powered by Kubernetes, Docker, NodeJs, and Redis.

User-Friendly Frontend: Developed with Google Maps API and React for an interactive and responsive experience.

# Technology Stack

Frontend: React, Google Maps API
Backend: NodeJs, Redis
Data Storage: MongoDB
Data Ingestion: SpotcrimeAPI, Yahoo News (scrapped with Named Entity Recognition), user uploads (Kafka streams)
Containerization and Orchestration: Docker, Kubernetes

# Installation

Prerequisites
Node.js
MongoDB
Docker
Kubernetes
Redis

# Steps to run the application
1) Clone the Repository
2) Install Dependencies
3) Run docker files using docker-compose up
4) Start the application using npm start command.

# Usage
Access the Application: Open your browser and go to http://localhost:3000.
Enter Origin and Destination: Input your starting point and destination.
View Recommended Routes: SafeMap will display the safest and fastest routes based on real-time crime data.

