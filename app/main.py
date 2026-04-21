import warnings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.api.routes.overview import router as overview_router
from app.api.routes.traffic import router as traffic_router

load_dotenv()
warnings.filterwarnings("ignore")

app = FastAPI(title="Monarch API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(overview_router)
app.include_router(traffic_router)


@app.get("/")
def root():
    return {"status": "Monarch API running"}


@app.get("/health")
def health():
    return {"status": "ok"}
