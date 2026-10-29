package uce.edu.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import reactor.netty.DisposableServer;
import reactor.netty.http.server.HttpServer;

// Starts a fake backend that echoes "<path>|<X-Request-Id it received>" and checks the gateway routes to it.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GatewayRoutingTests {

    private static DisposableServer backend;

    @Autowired
    private WebTestClient client;

    @BeforeAll
    static void startBackend() {
        backend = HttpServer.create()
                .port(0)
                .handle((request, response) -> response.sendString(reactor.core.publisher.Mono.just(
                        request.uri().equals("/echo-host")
                                ? request.requestHeaders().get("Host")
                                : request.uri() + "|" + request.requestHeaders().get(RequestLoggingFilter.REQUEST_ID))))
                .bindNow();
    }

    @AfterAll
    static void stopBackend() {
        backend.disposeNow();
    }

    @DynamicPropertySource
    static void backendUrl(DynamicPropertyRegistry registry) {
        registry.add("BACKEND_URL", () -> "http://localhost:" + backend.port());
    }

    @Test
    void apiRequestsGoToTheBackendWithGatewayHeaders() {
        client.get().uri("/api/entidades?query=ana").exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals("X-Gateway", "prograweb-gateway")
                .expectHeader().exists(RequestLoggingFilter.REQUEST_ID)
                .expectBody(String.class)
                .value(body -> assertThat(body).startsWith("/api/entidades?query=ana|"));
    }

    @Test
    void pagesGoToTheBackendThroughTheCatchAllRoute() {
        client.get().uri("/pagina1.html").exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .value(body -> assertThat(body).startsWith("/pagina1.html|"));
    }

    @Test
    void aValidRequestIdIsKeptAndForwarded() {
        client.get().uri("/api/entidades").header(RequestLoggingFilter.REQUEST_ID, "abc-123").exchange()
                .expectHeader().valueEquals(RequestLoggingFilter.REQUEST_ID, "abc-123")
                .expectBody(String.class)
                .value(body -> assertThat(body).isEqualTo("/api/entidades|abc-123"));
    }

    @Test
    void anUnsafeRequestIdIsReplaced() {
        client.get().uri("/api/entidades").header(RequestLoggingFilter.REQUEST_ID, "bad id <script>").exchange()
                .expectHeader().value(RequestLoggingFilter.REQUEST_ID,
                        id -> assertThat(id).matches("[0-9a-f-]{36}"));
    }

    @Test
    void theBackendReceivesThePublicHost() {
        client.get().uri("/entidades").header("Host", "prograweb.example:8080").exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .value(body -> assertThat(body).startsWith("/entidades|"));
        // The fake backend below answers with the Host it received on this path
        client.get().uri("/echo-host").header("Host", "prograweb.example:8080").exchange()
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
