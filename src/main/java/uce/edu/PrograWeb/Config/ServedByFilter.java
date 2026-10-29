package uce.edu.PrograWeb.Config;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

// Adds X-Served-By to every response, so it is visible which backend instance
// the load balancer in the API Gateway sent the request to.
@Component
public class ServedByFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Served-By";

    private final String instanceName;

    public ServedByFilter(@Value("${INSTANCE_NAME:${HOSTNAME:local}}") String instanceName) {
        this.instanceName = instanceName;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        response.setHeader(HEADER, instanceName);
        chain.doFilter(request, response);
    }
}
