package uce.edu.PrograWeb.Controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import uce.edu.PrograWeb.Model.Entidad;
import uce.edu.PrograWeb.Service.EntidadService;

@Controller
public class EntidadController {

    @Autowired
    private EntidadService servicio;

    @GetMapping("/")
    public String mostrarPaginaInicio() {
        return "index"; 
    }

    @GetMapping("/entidades")
    public String listarEntidades(Model modelo) {
        modelo.addAttribute("entidades", servicio.listarTodas());
        return "listar_entidades";
    }

    @GetMapping("/entidades/nueva")
    public String mostrarFormularioCrear(Model modelo) {
        Entidad entidad = new Entidad();
        modelo.addAttribute("entidad", entidad);
        return "nueva_entidad";
    }

    @PostMapping("/entidades")
    public String guardarEntidad(@ModelAttribute("entidad") Entidad entidad) {
        servicio.guardarEntidad(entidad);
        return "redirect:/entidades";
    }

    @GetMapping("/entidades/editar/{id}")
    public String mostrarFormularioEditar(@PathVariable Long id, Model modelo) {
        modelo.addAttribute("entidad", servicio.obtenerEntidadPorId(id));
        return "actualizar_entidad";
    }

    @PostMapping("/entidades/{id}")
    public String actualizarEntidad(@PathVariable Long id, @ModelAttribute("entidad") Entidad entidad) {
        Entidad entidadExistente = servicio.obtenerEntidadPorId(id);
        entidadExistente.setId(id);
        entidadExistente.setNombre(entidad.getNombre());
        entidadExistente.setApellido(entidad.getApellido());
        entidadExistente.setEmail(entidad.getEmail());
        servicio.guardarEntidad(entidadExistente);
        return "redirect:/entidades";
    }

    @GetMapping("/entidades/eliminar/{id}")
    public String eliminarEntidad(@PathVariable Long id) {
        servicio.eliminarEntidad(id);
        return "redirect:/entidades";
    }
}