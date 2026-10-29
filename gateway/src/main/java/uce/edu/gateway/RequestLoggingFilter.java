package uce.edu.gateway;

import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import reactor.core.publisher.Mono;

// Runs for every route: gives each request an X-Request-Id (kept if the client sent a valid one),
// forwards it to the backend, returns it to the client and logs method, path, status and time.
@Component
public class RequestLoggingFilter implements GlobalFilter, Ordered {

    public static final String REQUEST_ID = "X-Request-Id";

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);
    // Only simple ids are accepted, so a client cannot inject text into headers or logs
    private static final Pattern VALID_ID = Pattern.compile("[A-Za-z0-9-]{1,64}");

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String incoming = exchange.getRequest().getHeaders().getFirst(REQUEST_ID);
        String requestId = incoming != null && VALID_ID.matcher(incoming).matches()
                ? incoming
                : UUID.randomUUID().toString();

        ServerWebExchange withId = exchange.mutate()
                .request(request -> request.headers(headers -> headers.set(REQUEST_ID, requestId)))
                .build();
        withId.getResponse().getHeaders().set(REQUEST_ID, requestId);

        long start = System.nanoTime();
        return chain.filter(withId).doFinally(signal -> log.info("{} {} -> {} in {} ms [{}]",
                withId.getRequest().getMethod(),
                withId.getRequest().getURI().getRawPath(),
                withId.getResponse().getStatusCode(),
                (System.nanoTime() - start) / 1_000_000,
                requestId));
    }

    @Override
    public int getOrder() {
        // Before the routing filters, so the id travels with the proxied request
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
