package uce.edu.PrograWeb.Controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import uce.edu.PrograWeb.Model.Entidad;
import uce.edu.PrograWeb.Repository.EntidadRepository;
import java.util.List;

@RestController
@RequestMapping("/api/entidades")
@CrossOrigin(origins = "*") // Lets the frontend call the API from any origin
public class EntidadRestController {

    @Autowired
    private EntidadRepository repositorio;

    // Returns all entities, or searches by name (real-time search)
    @GetMapping
    public List<Entidad> obtenerEntidades(@RequestParam(required = false) String query) {
        if (query != null && !query.trim().isEmpty()) {
            return repositorio.findByNombreContainingIgnoreCase(query);
        }
        return repositorio.findAll();
    }
}