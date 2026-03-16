"""
Memoo Google Cloud architecture diagram.

Render with:
  python architecture.py
"""

from diagrams import Cluster, Diagram, Edge
from diagrams.gcp.compute import CloudRun, ComputeEngine
from diagrams.gcp.database import SQL
from diagrams.gcp.devtools import ContainerRegistry
from diagrams.gcp.network import CDN, VirtualPrivateCloud
from diagrams.gcp.operations import Logging, Monitoring
from diagrams.gcp.security import Iam, SecretManager
from diagrams.gcp.storage import GCS
from diagrams.gcp.ml import VertexAI
from diagrams.onprem.client import Users


GRAPH_ATTR = {
    "bgcolor": "white",
    "pad": "1.5",
    "nodesep": "1.5",
    "ranksep": "2.0",
    "splines": "curved",
    "fontname": "Helvetica",
    "fontsize": "18",
    "labelloc": "t",
}

NODE_ATTR = {
    "fontname": "Helvetica",
    "fontsize": "11",
}

EDGE_ATTR = {
    "fontname": "Helvetica",
    "fontsize": "9",
}

with Diagram(
    "Memoo - Google Cloud Architecture",
    filename="memoo_gcp_architecture",
    outformat=["png", "svg"],
    show=False,
    direction="TB",
    graph_attr=GRAPH_ATTR,
    node_attr=NODE_ATTR,
    edge_attr=EDGE_ATTR,
):
    # External Entry
    users = Users("End Users")
    cdn = CDN("Cloud CDN\nHTTPS")
    
    users >> Edge(color="#1f77b4", penwidth="2.5") >> cdn

    with Cluster("Google Cloud Platform", graph_attr={"style": "filled", "bgcolor": "#f0f8ff", "fontsize": "14"}):
        
        # Frontend
        frontend = CloudRun("Frontend\nCloud Run\n(Next.js)")
        cdn >> Edge(color="#1f77b4", penwidth="2.5") >> frontend

        # Backend
        backend = CloudRun("Backend\nCloud Run\n(FastAPI)")
        frontend >> Edge(color="#1f77b4", penwidth="2.0") >> backend

        # Sandbox
        sandbox = ComputeEngine("Sandbox VM\nCompute Engine\n(Playwright)")

        # AI Service
        ai = VertexAI("AI Engine\nVertex AI\n(Gemini)")

        # Databases & Storage
        db = SQL("Database\nCloud SQL")
        storage = GCS("Storage\nCloud Storage")
        secrets = SecretManager("Secrets\nSecret Manager")

        # Operations
        registry = ContainerRegistry("Registry\nArtifact Registry")
        iam = Iam("IAM\nService Accounts")
        logging = Logging("Logging\nCloud Logging")
        monitoring = Monitoring("Monitoring\nCloud Monitoring")

        # VPC Network (background concept)
        vpc = VirtualPrivateCloud("VPC Network")

        # Main Backend Connections
        backend >> Edge(color="#2ca02c", penwidth="2.0") >> sandbox
        backend >> Edge(color="#ff6600", penwidth="2.0") >> ai
        ai >> Edge(color="#ff6600", penwidth="2.0") >> backend

        # Data Access Layer
        backend >> Edge(color="#d62728", penwidth="1.8") >> db
        backend >> Edge(color="#d62728", penwidth="1.8") >> storage
        backend >> Edge(color="#9467bd", penwidth="1.5") >> secrets

        # Deployment & Security
        registry >> Edge(color="#bcbd22", style="dashed", penwidth="1.2") >> frontend
        registry >> Edge(color="#bcbd22", style="dashed", penwidth="1.2") >> backend
        registry >> Edge(color="#bcbd22", style="dashed", penwidth="1.2") >> sandbox

        iam >> Edge(color="#7f7f7f", style="dashed", penwidth="1.2") >> frontend
        iam >> Edge(color="#7f7f7f", style="dashed", penwidth="1.2") >> backend
        iam >> Edge(color="#7f7f7f", style="dashed", penwidth="1.2") >> sandbox

        # Observability
        frontend >> Edge(color="#17becf", penwidth="1.2") >> logging
        backend >> Edge(color="#17becf", penwidth="1.2") >> logging
        sandbox >> Edge(color="#17becf", penwidth="1.2") >> logging
        logging >> Edge(color="#17becf", penwidth="1.2") >> monitoring

        # VPC connections (invisible backbone)
        vpc >> Edge(style="invis") >> db
        vpc >> Edge(style="invis") >> storage
        vpc >> Edge(style="invis") >> secrets
