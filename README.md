# RideWay

RideWay is a full-stack ride booking application (similar to Uber and Ola) supporting Bikes, Autos, and Cabs. It is built using Java 25 Spring Boot microservices and a React frontend.

The system uses Redis to quickly find nearby drivers, Apache Kafka for background messaging between microservices, and WebSockets (STOMP) to send instant ride alerts to drivers.

---

## How It Works

1. A rider selects their pickup and drop location on the map, chooses a Bike, Auto, or Cab, and books the ride.
2. The backend searches Redis to find active drivers of that vehicle type near the pickup location.
3. The nearest driver gets a ride offer on their screen with an alert sound via WebSocket.
4. Once the driver accepts, the ride is locked so other drivers cannot take it.
5. Both the rider and driver get live updates throughout the trip, and payment is completed through Cash or Razorpay.

---

## The Microservices

Each backend service handles one specific domain:

- api-gateway: Takes all requests from the frontend, checks login tokens, and sends them to the right microservice.
- rideway-identity-service: Manages user and driver accounts, OTP verification using 2Factor, and login tokens.
- rideway-ride-service: Creates rides, calculates road distance using OSRM, calculates prices for Bike, Auto, and Cab, and tracks ride status.
- dispatch-service: Tracks driver GPS locations in Redis and matches nearby drivers with ride offers.
- payment-service: Handles ride payments for both Cash and online Razorpay.
- notification-service: Shows the ride offer pop-up and trip updates on driver and rider screens using WebSocket.
- rideway-eureka-server: Keeps track of running microservices so they can call each other by service name, even when multiple instances are running under load.
- config-server: Loads .yml configuration files from GitHub for each microservice.

---

## How Kafka Events Connect the Services

Instead of services making direct HTTP calls to each other, they communicate through Kafka:

- When a ride is booked, ride-service saves the trip and publishes a RIDE_REQUESTED event.
- dispatch-service reads that event, finds the closest matching driver in Redis, and publishes NEW_RIDE_OFFER.
- notification-service reads the offer and pushes it to the driver screen via WebSocket.
- When the driver accepts, dispatch-service locks the ride and publishes RIDE_ASSIGNED so ride-service updates the trip status.

---

## Tech Stack

Frontend:
- React
- Vite
- Tailwind CSS
- Leaflet & React-Leaflet
- STOMP.js & SockJS
- Axios

Backend:
- Java 25
- Spring Boot 4.1.2
- Spring Cloud Gateway 2025.1.4
- Netflix Eureka Server
- Spring Cloud Config Server
- Apache Kafka (Aiven)
- Redis (Upstash)
- PostgreSQL (Neon)
- Razorpay Payment Gateway
