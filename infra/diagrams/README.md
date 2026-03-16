# Memoo GCP Architecture Diagrams

Diagrams de la arquitectura de Memoo en Google Cloud Platform generados con [Diagrams](https://diagrams.mingrammer.com/).

## Requisitos Previos

- Python 3.8 o superior
- pip (gestor de paquetes de Python)
- Graphviz (requerido por Diagrams para generar las imágenes)

### Instalar Graphviz

**En Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install graphviz
```

**En macOS:**
```bash
brew install graphviz
```

**En Windows:**
```bash
choco install graphviz
```

## Instalación

1. Navega al directorio de diagramas:
```bash
cd infra/diagrams
```

2. Crea un entorno virtual (opcional pero recomendado):
```bash
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

3. Instala las dependencias:
```bash
pip install -r requirements.txt
```

## Uso

### Generar el diagrama de arquitectura

```bash
cd infra/diagrams
python3 -m pip install -r requirements.txt
python3 architecture.py
```

Esto generará un archivo llamado `memoo_gcp_architecture.png` en el directorio actual.

### Formatos de salida adicionales

Puedes modificar el script para generar diferentes formatos cambiando la extensión del archivo:

```python
filename="memoo_architecture"  # Sin extensión para PNG por defecto
# filename="memoo_architecture"  # Agrega .png, .svg, .dot según necesites
```

## Arquitectura Visualizada

El diagrama muestra los siguientes componentes de GCP:

### Servicios Serverless
- **Cloud Run - Web Service**: Servicio Next.js (Frontend)
- **Cloud Run - API Service**: Servicio FastAPI (Backend)

### Base de Datos
- **Cloud SQL**: PostgreSQL 16

### Compute
- **Compute Engine**: VM para el sandbox con Debian 12

### Storage
- **Storage Bucket**: Bucket para evidencias

### Red
- **VPC Network**: Red virtual privada (10.10.0.0/24)
- **VPC Access Connector**: Conector para acceso serverless a recursos privados
- **Firewall Rules**: Reglas para HTTPS (80/443), CDP (9223), SSH (22)

### Seguridad
- **Secret Manager**: Gestión de contraseñas y API keys
- **IAM**: Service accounts para api, web y sandbox

### Servicios Externos
- **Gemini API**: Modelo de IA gemini-2.5-flash

### Operaciones
- **Monitoring**: Métricas de los servicios
- **Logging**: Logs de los servicios

## Personalización

Puedes personalizar el diagrama editando el archivo `architecture.py`:

- Cambiar colores y estilos
- Agregar o remover componentes
- Modificar las etiquetas y conexiones
- Cambiar la dirección del diagrama (TB = top-to-bottom, LR = left-to-right, etc.)

## Referencias

- [Documentación de Diagrams](https://diagrams.mingrammer.com/)
- [Documentación de Terraform GCP](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [Arquitectura de referencia de Cloud Run](https://cloud.google.com/architecture/architecture-diagram-cloud-run)
