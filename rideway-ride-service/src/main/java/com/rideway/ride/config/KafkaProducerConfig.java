package com.rideway.ride.config;

import org.apache.kafka.clients.CommonClientConfigs;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.config.SslConfigs;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaProducerConfig {

    private final Environment env;

    @Value("${spring.kafka.bootstrap-servers:${KAFKA_BOOTSTRAP_SERVERS:kafka:9092}}")
    private String bootstrapServers;

    public KafkaProducerConfig(Environment env) {
        this.env = env;
    }

    @Bean
    public ProducerFactory<String, Object> producerFactory() {
        Map<String, Object> properties = new HashMap<>();
        properties.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        properties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        properties.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        properties.put(ProducerConfig.MAX_BLOCK_MS_CONFIG, 2000);
        properties.put(ProducerConfig.RETRIES_CONFIG, 1);

        String securityProtocol = env.getProperty("spring.kafka.properties.security.protocol", env.getProperty("KAFKA_SECURITY_PROTOCOL"));
        if (securityProtocol != null && !securityProtocol.isBlank()) {
            properties.put(CommonClientConfigs.SECURITY_PROTOCOL_CONFIG, securityProtocol);
        }

        String saslMechanism = env.getProperty("spring.kafka.properties.sasl.mechanism", env.getProperty("KAFKA_SASL_MECHANISM"));
        if (saslMechanism != null && !saslMechanism.isBlank()) {
            properties.put("sasl.mechanism", saslMechanism);
        }

        String saslJaasConfig = env.getProperty("spring.kafka.properties.sasl.jaas.config", env.getProperty("KAFKA_SASL_JAAS_CONFIG"));
        if (saslJaasConfig != null && !saslJaasConfig.isBlank()) {
            properties.put("sasl.jaas.config", saslJaasConfig);
        }

        String sslEndpoint = env.getProperty("spring.kafka.properties.ssl.endpoint.identification.algorithm", env.getProperty("KAFKA_SSL_ENDPOINT_IDENTIFICATION"));
        if (sslEndpoint != null && !sslEndpoint.isBlank()) {
            properties.put(SslConfigs.SSL_ENDPOINT_IDENTIFICATION_ALGORITHM_CONFIG, sslEndpoint);
        }

        String truststoreType = env.getProperty("spring.kafka.properties.ssl.truststore.type", env.getProperty("KAFKA_SSL_TRUSTSTORE_TYPE", "PEM"));
        if (truststoreType != null && !truststoreType.isBlank()) {
            properties.put(SslConfigs.SSL_TRUSTSTORE_TYPE_CONFIG, truststoreType);
        }

        String truststoreLocation = env.getProperty("spring.kafka.properties.ssl.truststore.location", env.getProperty("KAFKA_SSL_TRUSTSTORE_LOCATION"));
        if ((truststoreLocation == null || truststoreLocation.isBlank()) && new File("C:/spring-project/ca.pem").exists()) {
            truststoreLocation = "C:/spring-project/ca.pem";
        }
        if (truststoreLocation != null && !truststoreLocation.isBlank()) {
            properties.put(SslConfigs.SSL_TRUSTSTORE_LOCATION_CONFIG, truststoreLocation);
        }

        return new DefaultKafkaProducerFactory<>(properties);
    }

    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        return new KafkaTemplate<>(producerFactory());
    }
}
