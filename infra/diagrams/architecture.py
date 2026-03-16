"""
Memoo Google Cloud architecture diagram.

Render with:
  python architecture.py
"""

from diagrams import Cluster, Diagram, Edge
from diagrams.gcp.compute import CloudRun, ComputeEngine
from diagrams.gcp.database import SQL
from diagrams.gcp.devtools import ContainerRegistry
from diagrams.gcp.network import CDN, Router, VirtualPrivateCloud
from diagrams.gcp.operations import Logging, Monitoring
from diagrams.gcp.security import Iam, SecretManager
from diagrams.gcp.storage import GCS
from diagrams.gcp.ml import VertexAI
from diagrams.onprem.client import User


GRAPH_ATTR = {
    "bgcolor": "white",
    "pad": "0.45",
    "nodesep": "0.7",
    "ranksep": "0.9",
    "splines": "ortho",
    "compound": "true",
    "newrank": "true",
    "fontname": "Helvetica",
    "fontsize": "22",
    "labelloc": "t",
}

NODE_ATTR = {
    "fontname": "Helvetica",
    "fontsize": "12",
}

EDGE_ATTR = {
    "fontname": "Helvetica",
    "fontsize": "10",
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
    users = User("Workspace users")
    ops_team = User("Platform team")
    internet = CDN("Public HTTPS access")

    users >> Edge(color="#3768d9", penwidth="1.8", label="app + live browser") >> internet

    with Cluster("Google Cloud Project"):
        with Cluster("Product Surface"):
            web = CloudRun("Cloud Run\nmemoo-web\nNext.js frontend")
            api = CloudRun("Cloud Run\nmemoo-api\nFastAPI backend")
            sandbox = ComputeEngine("Compute Engine VM\nmemoo-sandbox\nVisible browser + noVNC")

            web >> Edge(color="#3768d9", penwidth="1.8", label="/api/proxy") >> api

        with Cluster("AI Integration"):
            gemini = VertexAI("Google Vertex AI\nGemini Model")
            api >> Edge(color="#ff6d00", penwidth="2.0", label="live interaction\n+ code generation") >> gemini
            gemini >> Edge(color="#ff6d00", penwidth="2.0", label="AI responses") >> api

        with Cluster("Private Connectivity"):
            vpc = VirtualPrivateCloud("VPC\nmemoo-vpc")
            connector = Router("Serverless VPC Access\n10.10.1.0/28")

            api >> Edge(color="#4d5b75", penwidth="1.5", label="private egress") >> connector
            vpc - Edge(style="invis") - connector

        with Cluster("Data Plane"):
            sql = SQL("Cloud SQL\nPostgreSQL 16\ndb-g1-small")
            bucket = GCS("Cloud Storage\nEvidence bucket")
            secrets = SecretManager("Secret Manager\nDB password + Gemini key")

            connector >> Edge(color="#4d5b75", penwidth="1.5", label="Cloud SQL socket") >> sql
            connector >> Edge(color="#4d5b75", penwidth="1.5", label="CDP :9223") >> sandbox
            api >> Edge(color="#2f7d57", penwidth="1.3", label="evidence read/write") >> bucket
            api >> Edge(color="#ff6d00", penwidth="1.5", label="Gemini API key") >> secrets
            api >> Edge(color="#4d5b75", penwidth="1.5", label="secret access") >> secrets

        with Cluster("Platform Operations"):
            registry = ContainerRegistry("Artifact Registry\nmemoo-containers")
            iam = Iam("Service identities\nweb / api / sandbox")
            logging = Logging("Cloud Logging")
            monitoring = Monitoring("Monitoring + cost alerts")

            registry >> Edge(color="#a66b00", style="dashed", penwidth="1.3", label="image pull") >> web
            registry >> Edge(color="#a66b00", style="dashed", penwidth="1.3", label="image pull") >> api
            registry >> Edge(color="#a66b00", style="dashed", penwidth="1.3", label="image pull") >> sandbox

            iam >> Edge(color="#a66b00", style="dashed", penwidth="1.3", label="runtime identity") >> web
            iam >> Edge(color="#a66b00", style="dashed", penwidth="1.3", label="runtime identity") >> api
            iam >> Edge(color="#a66b00", style="dashed", penwidth="1.3", label="runtime identity") >> sandbox

            web >> Edge(color="#2f7d57", penwidth="1.3", label="telemetry") >> logging
            api >> Edge(color="#2f7d57", penwidth="1.3", label="telemetry") >> logging
            sandbox >> Edge(color="#2f7d57", penwidth="1.3", label="telemetry") >> logging

            web >> Edge(color="#2f7d57", penwidth="1.3", label="metrics") >> monitoring
            api >> Edge(color="#2f7d57", penwidth="1.3", label="metrics") >> monitoring
            sandbox >> Edge(color="#2f7d57", penwidth="1.3", label="metrics") >> monitoring

    internet >> Edge(color="#3768d9", penwidth="1.8", label="frontend") >> web
    internet >> Edge(color="#3768d9", penwidth="1.8", label="live session") >> sandbox
    monitoring >> Edge(color="#2f7d57", penwidth="1.3", label="alerts") >> ops_team
