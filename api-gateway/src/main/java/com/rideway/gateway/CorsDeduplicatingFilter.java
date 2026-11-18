package com.rideway.gateway;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Collection;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorsDeduplicatingFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        if (response instanceof HttpServletResponse httpServletResponse) {
            HttpServletResponseWrapper wrapper = new HttpServletResponseWrapper(httpServletResponse) {
                @Override
                public void addHeader(String name, String value) {
                    if ("Access-Control-Allow-Origin".equalsIgnoreCase(name) || "Access-Control-Allow-Credentials".equalsIgnoreCase(name)) {
                        super.setHeader(name, value);
                    } else {
                        super.addHeader(name, value);
                    }
                }
            };

            chain.doFilter(request, wrapper);

            Collection<String> originHeaders = httpServletResponse.getHeaders("Access-Control-Allow-Origin");
            if (originHeaders != null && originHeaders.size() > 1) {
                String firstOrigin = originHeaders.iterator().next();
                httpServletResponse.setHeader("Access-Control-Allow-Origin", firstOrigin);
            }

            Collection<String> credHeaders = httpServletResponse.getHeaders("Access-Control-Allow-Credentials");
            if (credHeaders != null && credHeaders.size() > 1) {
                httpServletResponse.setHeader("Access-Control-Allow-Credentials", "true");
            }
        } else {
            chain.doFilter(request, response);
        }
    }
}
