package uce.edu.PrograWeb.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import uce.edu.PrograWeb.Model.Entidad;
import java.util.List;

@Repository
public interface EntidadRepository extends JpaRepository<Entidad, Long> {
    // Spring derived query: search by name, case-insensitive
    List<Entidad> findByNombreContainingIgnoreCase(String nombre);
}