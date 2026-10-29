package uce.edu.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import reactor.core.publisher.Mono;
import reactor.netty.DisposableServer;
import reactor.netty.http.server.HttpServer;

// Starts two fake backend instances ("b1", "b2") and checks routing and load balancing.
// Each one answers "<instance>|<path>|<X-Request-Id it received>", or the Host header on /echo-host.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GatewayRoutingTests {

    private static DisposableServer backend1;
    private static DisposableServer backend2;

    @Autowired
    private WebTestClient client;

    private static DisposableServer fakeBackend(String name) {
        return HttpServer.create()
                .port(0)
                .handle((request, response) -> response.sendString(Mono.just(
                        request.uri().equals("/echo-host")
                                ? request.requestHeaders().get("Host")
                                : name + "|" + request.uri() + "|"
                                        + request.requestHeaders().get(RequestLoggingFilter.REQUEST_ID))))
                .bindNow();
    }

    @BeforeAll
    static void startBackends() {
        backend1 = fakeBackend("b1");
        backend2 = fakeBackend("b2");
    }

    @AfterAll
    static void stopBackends() {
        backend1.disposeNow();
        backend2.disposeNow();
    }

    @DynamicPropertySource
    static void backendUrls(DynamicPropertyRegistry registry) {
        registry.add("BACKEND_1_URL", () -> "http://localhost:" + backend1.port());
        registry.add("BACKEND_2_URL", () -> "http://localhost:" + backend2.port());
        // Plain round robin in tests: the periodic health check is covered by the docker compose test
        registry.add("spring.cloud.loadbalancer.configurations", () -> "default");
    }

    @Test
    void apiRequestsGoToTheBackendWithGatewayHeaders() {
        client.get().uri("/api/entidades?query=ana").exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals("X-Gateway", "prograweb-gateway")
                .expectHeader().exists(RequestLoggingFilter.REQUEST_ID)
                .expectBody(String.class)
                .value(body -> assertThat(body).contains("|/api/entidades?query=ana|"));
    }

    @Test
    void pagesGoToTheBackendThroughTheCatchAllRoute() {
        client.get().uri("/pagina1.html").exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .value(body -> assertThat(body).contains("|/pagina1.html|"));
    }

    @Test
    void requestsAreSpreadOverBothInstances() {
        List<String> instances = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            client.get().uri("/api/entidades").exchange()
                    .expectStatus().isOk()
                    .expectBody(String.class)
                    .value(body -> instances.add(body.substring(0, 2)));
        }
        // Round robin: two consecutive requests never hit the same instance
        assertThat(instances).containsOnly("b1", "b2");
        for (int i = 1; i < instances.size(); i++) {
            assertThat(instances.get(i)).isNotEqualTo(instances.get(i - 1));
        }
    }

    @Test
    void aValidRequestIdIsKeptAndForwarded() {
        client.get().uri("/api/entidades").header(RequestLoggingFilter.REQUEST_ID, "abc-123").exchange()
                .expectHeader().valueEquals(RequestLoggingFilter.REQUEST_ID, "abc-123")
                .expectBody(String.class)
                .value(body -> assertThat(body).endsWith("|/api/entidades|abc-123"));
    }

    @Test
    void anUnsafeRequestIdIsReplaced() {
        client.get().uri("/api/entidades").header(RequestLoggingFilter.REQUEST_ID, "bad id <script>").exchange()
                .expectHeader().value(RequestLoggingFilter.REQUEST_ID,
                        id -> assertThat(id).matches("[0-9a-f-]{36}"));
    }

    @Test
    void theBackendReceivesThePublicHost() {
        client.get().uri("/echo-host").header("Host", "prograweb.example:8080").exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .value(body -> assertThat(body).isEqualTo("prograweb.example:8080"));
    }

    @Test
    void healthEndpointIsUp() {
        client.get().uri("/actuator/health").exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.status").isEqualTo("UP");
    }
}
