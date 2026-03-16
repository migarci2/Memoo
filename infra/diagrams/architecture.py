"""
Memoo Google Cloud architecture diagram.

Render with:
  python architecture.py
"""

from diagrams import Cluster, Diagram, Edge
from diagrams.gcp.compute import CloudRun, ComputeEngine
from diagrams.gcp.database import SQL
from diagrams.gcp.ml import VertexAI
from diagrams.gcp.network import CDN, LoadBalancing
from diagrams.gcp.security import SecretManager
from diagrams.gcp.storage import GCS
from diagrams.onprem.client import Users


GRAPH_ATTR = {
    "bgcolor": "#fcfcfd",
    "pad": "1.0",
    "nodesep": "1.0",
    "ranksep": "1.25",
    "splines": "ortho",
    "fontname": "Helvetica",
    "fontsize": "20",
    "labelloc": "t",
    "labeljust": "l",
    "compound": "true",
}

NODE_ATTR = {
    "fontname": "Helvetica",
    "fontsize": "11",
    "margin": "0.18,0.12",
}

EDGE_ATTR = {
    "fontname": "Helvetica",
    "fontsize": "10",
    "penwidth": "1.8",
}

CLUSTER_PUBLIC = {
    "style": "rounded,filled",
    "bgcolor": "#eef6ff",
    "pencolor": "#bfd8f4",
    "fontname": "Helvetica",
    "fontsize": "13",
    "labeljust": "l",
}

CLUSTER_PRIVATE = {
    "style": "rounded,filled",
    "bgcolor": "#f7f8fa",
    "pencolor": "#d9dee7",
    "fontname": "Helvetica",
    "fontsize": "13",
    "labeljust": "l",
}

PUBLIC_EDGE = {"color": "#2b6cb0"}
APP_EDGE = {"color": "#1f5c84"}
PRIVATE_EDGE = {"color": "#1b8b82"}
DATA_EDGE = {"color": "#c96f23"}


with Diagram(
    "Memoo - Google Cloud Architecture",
    filename="memoo_gcp_architecture",
    outformat=["png", "svg"],
    show=False,
    direction="LR",
    graph_attr=GRAPH_ATTR,
    node_attr=NODE_ATTR,
    edge_attr=EDGE_ATTR,
):
    users = Users("Operators\nand teammates")

    with Cluster("Public entry", graph_attr=CLUSTER_PUBLIC):
        edge = CDN("HTTPS edge\nstatic + cached assets")
        lb = LoadBalancing("Public routing\nweb + sandbox access")

    with Cluster("Google Cloud project", graph_attr=CLUSTER_PRIVATE):
        with Cluster("Application services", graph_attr=CLUSTER_PRIVATE):
            web = CloudRun("apps/web\nCloud Run\nNext.js UI")
            api = CloudRun("apps/api\nCloud Run\nFastAPI orchestration")
            agent = CloudRun("apps/agent\nCloud Run\nStagehand fallback")

        with Cluster("Execution plane", graph_attr=CLUSTER_PUBLIC):
            sandbox = ComputeEngine("Sandbox VM\nLive browser view\nChromium + CDP + noVNC")

        with Cluster("Data and AI", graph_attr=CLUSTER_PRIVATE):
            db = SQL("Cloud SQL\nPostgreSQL")
            storage = GCS("Cloud Storage\nEvidence bucket")
            secrets = SecretManager("Secret Manager")
            gemini = VertexAI("Gemini API\nvision + compile + agent")

    users >> Edge(label="HTTPS", **PUBLIC_EDGE) >> edge >> Edge(**PUBLIC_EDGE) >> lb

    lb >> Edge(label="product UI", **APP_EDGE) >> web
    lb >> Edge(**PUBLIC_EDGE) >> sandbox

    web >> Edge(label="/api/proxy", **APP_EDGE) >> api
    api >> Edge(label="playbook CRUD\ncapture, runs, automations", **DATA_EDGE) >> db
    api >> Edge(label="screenshots + evidence", **DATA_EDGE) >> storage
    api >> Edge(label="runtime config + API keys", **PRIVATE_EDGE) >> secrets

    api >> Edge(label="frame analysis\ncompile steps", **PRIVATE_EDGE) >> gemini
    agent >> Edge(label="autonomous reasoning", **PRIVATE_EDGE) >> gemini

    api >> Edge(label="selector path\nor sandbox mode", **PRIVATE_EDGE) >> sandbox
    api >> Edge(label="fallback request", **APP_EDGE) >> agent
    agent >> Edge(label="shared browser via CDP", **PRIVATE_EDGE) >> sandbox
