package uce.edu.PrograWeb.Controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import uce.edu.PrograWeb.Model.Entidad;
import uce.edu.PrograWeb.Repository.EntidadRepository;
import java.util.List;

@RestController
@RequestMapping("/api/entidades")
@CrossOrigin(origins = "*") // Permite al frontend conectarse sin bloqueos
public class EntidadRestController {

    @Autowired
    private EntidadRepository repositorio;

    // Endpoint para obtener todos o buscar por nombre (Búsqueda en tiempo real)
    @GetMapping
    public List<Entidad> obtenerEntidades(@RequestParam(required = false) String query) {
        if (query != null && !query.trim().isEmpty()) {
            return repositorio.findByNombreContainingIgnoreCase(query);
        }
        return repositorio.findAll();
    }
}