# Stage 1: Build Payment Service JAR using Maven and Java 25
FROM maven:3-eclipse-temurin-25 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: Minimal Java 25 runtime image
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8085
ENTRYPOINT ["sh", "-c", "java -Xms128m -Xmx256m -Dserver.port=${PORT:-8085} -jar app.jar"]
