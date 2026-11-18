# Stage 1: Build Notification Service JAR using Maven and Java 25
FROM maven:3-eclipse-temurin-25 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: Minimal Java 25 runtime image
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
COPY --from=build /app/src/main/resources/ca.pem /etc/secrets/ca.pem
EXPOSE 8083
ENTRYPOINT ["sh", "-c", "java -Xms128m -Xmx256m -Dserver.port=${PORT:-8083} -jar app.jar"]
