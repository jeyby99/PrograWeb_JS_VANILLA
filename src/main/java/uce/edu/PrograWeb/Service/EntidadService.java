package uce.edu.PrograWeb.Service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import uce.edu.PrograWeb.Model.Entidad;
import uce.edu.PrograWeb.Repository.EntidadRepository;
import java.util.List;

@Service
public class EntidadService {

    @Autowired
    private EntidadRepository repositorio;

    public List<Entidad> listarTodas() {
        return repositorio.findAll();
    }

    public Entidad guardarEntidad(Entidad entidad) {
        return repositorio.save(entidad);
    }

    public Entidad obtenerEntidadPorId(Long id) {
        return repositorio.findById(id).orElse(null);
    }

    public void eliminarEntidad(Long id) {
        repositorio.deleteById(id);
    }
}