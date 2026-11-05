package uce.edu.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import reactor.core.publisher.Mono;
import reactor.netty.DisposableServer;
import reactor.netty.http.server.HttpServer;

// Two live fake instances + one dead one (its port is closed): what the client sees with the
// good balancer (Retry on) and with the bad-balancer profile (no Retry, no health check).
class BalancerFailoverTests {

    private static DisposableServer alive1;
    private static DisposableServer alive2;
    private static int deadPort;

    @BeforeAll
    static void startInstances() {
        alive1 = fake("b1");
        alive2 = fake("b2");
        DisposableServer dead = fake("b3");
        deadPort = dead.port();
        dead.disposeNow();   // the instance "crashed": connections to its port are refused
    }

    @AfterAll
    static void stopInstances() {
        alive1.disposeNow();
        alive2.disposeNow();
    }

    private static DisposableServer fake(String name) {
        return HttpServer.create().port(0)
                .handle((request, response) -> response.sendString(Mono.just(name)))
                .bindNow();
    }

    static void instances(DynamicPropertyRegistry registry) {
        registry.add("BACKEND_1_URL", () -> "http://localhost:" + alive1.port());
        registry.add("BACKEND_2_URL", () -> "http://localhost:" + alive2.port());
        registry.add("BACKEND_3_URL", () -> "http://localhost:" + deadPort);
    }

    // "<status> <X-Balancer>" per request; error responses carry no X-Balancer (they skip the filters)
    private static List<String> results(WebTestClient client, int requests) {
        List<String> results = new ArrayList<>();
        for (int i = 0; i < requests; i++) {
            var result = client.get().uri("/api/entidades").exchange().returnResult(String.class);
            results.add(result.getStatus().value() + " "
                    + result.getResponseHeaders().getFirst("X-Balancer"));
        }
        return results;
    }

    @Nested
    @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
    class GoodBalancer {

        @Autowired
        private WebTestClient client;

        @DynamicPropertySource
        static void config(DynamicPropertyRegistry registry) {
            instances(registry);
            // Health check off here so the dead instance stays in the list: only Retry protects
            registry.add("spring.cloud.loadbalancer.configurations", () -> "default");
        }

        @Test
        void retryHidesTheDeadInstance() {
            assertThat(results(client, 9)).containsOnly("200 good");
        }
    }

    @Nested
    @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
    @ActiveProfiles("bad-balancer")
    class BadBalancer {

        @Autowired
        private WebTestClient client;

        @DynamicPropertySource
        static void config(DynamicPropertyRegistry registry) {
            instances(registry);
        }

        @Test
        void aboutOneThirdOfTheRequestsFail() {
            List<String> results = results(client, 9);
            // Round robin over 3 instances, one dead and no Retry: 3 of every 9 requests fail
            assertThat(results.stream().filter(r -> r.startsWith("5")).count()).isEqualTo(3);
            assertThat(results.stream().filter(r -> r.equals("200 bad")).count()).isEqualTo(6);
        }
    }
}
