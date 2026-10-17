# PrograWeb – CRUD + Búsqueda en Tiempo Real

Proyecto web full stack con backend en **Java Spring Boot** y frontend en **Vanilla JavaScript**.

## Tecnologías

- **Backend:** Java 17, Spring Boot 3.1.5 (Spring Web, Spring Data JPA, Thymeleaf)
- **Base de datos:** PostgreSQL
- **Frontend:** HTML, CSS y JavaScript puro (Vanilla JS)
- **Diseño responsivo:** Bootstrap 5, Tailwind CSS, CSS Grid, Flexbox y Media Queries
- **APIs externas:** [Rick and Morty API](https://rickandmortyapi.com) y [PokéAPI](https://pokeapi.co)

## Funcionalidades

### Backend
- CRUD completo de entidades (nombre, apellido, email) con vistas Thymeleaf.
- API REST en `/api/entidades` con búsqueda por nombre (`?query=`) y CORS habilitado.

### Página 1 – Búsqueda en tiempo real
Consulta el backend propio en cada tecla y muestra los registros en tarjetas.

### Página 2 – Búsqueda con debounce y APIs externas
Espera 4 segundos tras dejar de escribir (o Enter / botón Buscar) y consulta 6 endpoints:

| API | Endpoints |
|---|---|
| Rick and Morty | `character`, `location`, `episode` |
| PokéAPI | `pokemon`, `item`, `berry` |

Cada resultado muestra su descripción e imagen. Al abrir la página se cargan personajes de "Rick" por defecto.

## Estructura del proyecto

```
PrograWeb/
├── pom.xml
└── src/main
    ├── java/uce/edu/PrograWeb
    │   ├── Controller/   (EntidadController, EntidadRestController)
    │   ├── Model/        (Entidad)
    │   ├── Repository/   (EntidadRepository)
    │   └── Service/      (EntidadService)
    └── resources
        ├── application.properties
        ├── static/       (pagina1.html, pagina2.html)
        └── templates/    (index, listar, nueva y actualizar entidad)
```

## Requisitos

- JDK 17
- Maven
- PostgreSQL

## Cómo ejecutarlo

1. Crea la base de datos en PostgreSQL:
   ```sql
   CREATE DATABASE "PrograWeb";
   ```
2. Ajusta tu usuario y contraseña en `src/main/resources/application.properties`:
   ```properties
   spring.datasource.url=jdbc:postgresql://localhost:5432/PrograWeb
   spring.datasource.username=postgres
   spring.datasource.password=TU_CONTRASEÑA
   ```
3. Ejecuta la aplicación:
   ```bash
   mvn spring-boot:run
   ```
4. Abre en el navegador:
   - Inicio y CRUD: http://localhost:8080
   - Página 1: http://localhost:8080/pagina1.html
   - Página 2: http://localhost:8080/pagina2.html

Las tablas se crean solas gracias a `spring.jpa.hibernate.ddl-auto=update`.

## Autor

**jeyby99**
