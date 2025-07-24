"""
AFS FleetPro Internal API
Core shop management API for internal staff
"""

from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime
import logging
import time
import os
import motor.motor_asyncio
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(
    level=logging.getLevelName(os.environ.get("LOG_LEVEL", "INFO")),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("internal-api")

# Create FastAPI app
app = FastAPI(
    title="AFS FleetPro Internal API",
    description="Core shop management API for AFS FleetPro",
    version="0.1.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
mongo_client = None
db = None

# Service Order Status Enum (as strings for simplicity)
SERVICE_ORDER_STATUSES = [
    "service_requested",
    "tech_assigned",
    "tech_en_route",
    "tech_arrived",
    "diagnosis_in_progress",
    "awaiting_approval",
    "parts_being_sourced",
    "repair_in_progress",
    "quality_check",
    "repair_complete",
    "invoice_sent"
]

# Models
class ServiceOrderCreate(BaseModel):
    customer_id: str
    vehicle_id: str
    complaint: str
    service_type: str = "shop"
    urgency: str = "normal"
    
class ServiceOrderUpdate(BaseModel):
    complaint: Optional[str] = None
    cause: Optional[str] = None
    correction: Optional[str] = None
    status: Optional[str] = None
    technician_ids: Optional[List[str]] = None

class ServiceOrderResponse(BaseModel):
    id: str
    number: str
    customer_id: str
    vehicle_id: str
    status: str
    complaint: str
    cause: Optional[str] = None
    correction: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    tracker_public_token: str

# Database connection events
@app.on_event("startup")
async def startup_db_client():
    global mongo_client, db
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    mongo_client = motor.motor_asyncio.AsyncIOMotorClient(mongo_uri)
    db = mongo_client.afs_fleetpro
    logger.info("Connected to MongoDB")

@app.on_event("shutdown")
async def shutdown_db_client():
    global mongo_client
    if mongo_client:
        mongo_client.close()
        logger.info("Disconnected from MongoDB")

# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.3f}s")
    return response

# Health check endpoint
@app.get("/health")
async def health_check():
    try:
        # Simple ping to MongoDB to check connection
        # `db` is a Motor database object which does not support implicit
        # truth-value testing.  Compare explicitly with ``None``.
        if db is not None:
            await db.command("ping")
            return {"status": "ok", "service": "internal-api", "database": "connected"}
        return {"status": "ok", "service": "internal-api", "database": "not connected"}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "service": "internal-api", "message": str(e)}
        )

# Simplified auth for demo - in production use proper JWT
async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        return {"id": "demo-user", "role": "admin"}
    # In production, validate JWT here
    return {"id": "demo-user", "role": "admin"}

# Service Orders endpoints
@app.post("/internal/v1/service-orders", response_model=ServiceOrderResponse)
async def create_service_order(
    service_order: ServiceOrderCreate,
    current_user: Dict = Depends(get_current_user)
):
    try:
        # Generate service order number (simple sequential for demo)
        count = await db.service_orders.count_documents({})
        so_number = f"{datetime.now().year}-{count+1:05d}"
        
        # Create new service order
        new_so = {
            "number": so_number,
            "customer_id": service_order.customer_id,
            "vehicle_id": service_order.vehicle_id,
            "complaint": service_order.complaint,
            "service_type": service_order.service_type,
            "urgency": service_order.urgency,
            "status": "service_requested",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "created_by": current_user["id"],
            "updated_by": current_user["id"],
            "tracker_public_token": uuid4().hex,  # 32-char token for public tracker
            "tracker_events": [
                {
                    "status": "service_requested",
                    "timestamp": datetime.utcnow(),
                    "user_id": current_user["id"]
                }
            ]
        }
        
        result = await db.service_orders.insert_one(new_so)
        new_so["id"] = str(result.inserted_id)
        
        # Publish event to Redis (simplified for demo)
        # In production, use proper event bus
        logger.info(f"Service order created: {new_so['id']}")
        
        return new_so
    except Exception as e:
        logger.error(f"Error creating service order: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create service order: {str(e)}")

@app.get("/internal/v1/service-orders", response_model=List[ServiceOrderResponse])
async def list_service_orders(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    try:
        # Build filter
        filter_query = {}
        if status:
            filter_query["status"] = status
        if customer_id:
            filter_query["customer_id"] = customer_id
        if vehicle_id:
            filter_query["vehicle_id"] = vehicle_id
            
        # Query database
        cursor = db.service_orders.find(filter_query).skip(skip).limit(limit).sort("created_at", -1)
        service_orders = []
        
        async for document in cursor:
            document["id"] = str(document.pop("_id"))
            service_orders.append(document)
            
        return service_orders
    except Exception as e:
        logger.error(f"Error listing service orders: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list service orders: {str(e)}")

@app.get("/internal/v1/service-orders/{service_order_id}", response_model=ServiceOrderResponse)
async def get_service_order(
    service_order_id: str,
    current_user: Dict = Depends(get_current_user)
):
    try:
        from bson.objectid import ObjectId
        
        service_order = await db.service_orders.find_one({"_id": ObjectId(service_order_id)})
        if not service_order:
            raise HTTPException(status_code=404, detail="Service order not found")
            
        service_order["id"] = str(service_order.pop("_id"))
        return service_order
    except Exception as e:
        logger.error(f"Error getting service order: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get service order: {str(e)}")

@app.patch("/internal/v1/service-orders/{service_order_id}", response_model=ServiceOrderResponse)
async def update_service_order(
    service_order_id: str,
    service_order: ServiceOrderUpdate,
    current_user: Dict = Depends(get_current_user)
):
    try:
        from bson.objectid import ObjectId
        
        # Build update document
        update_data = {k: v for k, v in service_order.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow()
        update_data["updated_by"] = current_user["id"]
        
        # If status is updated, add to tracker events
        if "status" in update_data and update_data["status"] in SERVICE_ORDER_STATUSES:
            tracker_event = {
                "status": update_data["status"],
                "timestamp": datetime.utcnow(),
                "user_id": current_user["id"]
            }
            await db.service_orders.update_one(
                {"_id": ObjectId(service_order_id)},
                {"$push": {"tracker_events": tracker_event}}
            )
        
        # Update the service order
        result = await db.service_orders.update_one(
            {"_id": ObjectId(service_order_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Service order not found")
            
        # Get updated document
        updated_so = await db.service_orders.find_one({"_id": ObjectId(service_order_id)})
        updated_so["id"] = str(updated_so.pop("_id"))
        
        # Publish event (simplified)
        logger.info(f"Service order updated: {service_order_id}")
        
        return updated_so
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating service order: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update service order: {str(e)}")

@app.patch("/internal/v1/service-orders/{service_order_id}/status")
async def update_service_order_status(
    service_order_id: str,
    status_update: Dict[str, str],
    current_user: Dict = Depends(get_current_user)
):
    try:
        from bson.objectid import ObjectId
        
        new_status = status_update.get("status")
        if not new_status or new_status not in SERVICE_ORDER_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        # Update status
        update_data = {
            "status": new_status,
            "updated_at": datetime.utcnow(),
            "updated_by": current_user["id"]
        }
        
        # Add tracker event
        tracker_event = {
            "status": new_status,
            "timestamp": datetime.utcnow(),
            "user_id": current_user["id"]
        }
        
        # Update the service order
        result = await db.service_orders.update_one(
            {"_id": ObjectId(service_order_id)},
            {
                "$set": update_data,
                "$push": {"tracker_events": tracker_event}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Service order not found")
            
        # Get updated document
        updated_so = await db.service_orders.find_one({"_id": ObjectId(service_order_id)})
        updated_so["id"] = str(updated_so.pop("_id"))
        
        # Publish event (simplified)
        logger.info(f"Service order status updated: {service_order_id} -> {new_status}")
        
        return updated_so
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating service order status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update service order status: {str(e)}")

# Demo data endpoint - to quickly populate database
@app.post("/internal/v1/demo-data")
async def create_demo_data(current_user: Dict = Depends(get_current_user)):
    try:
        # Check if demo data already exists
        count = await db.service_orders.count_documents({})
        if count > 0:
            return {"message": "Demo data already exists", "count": count}
        
        # Create demo customers
        customers = [
            {"name": "Acme Logistics", "contact_email": "fleet@acmelogistics.com"},
            {"name": "XYZ Transport", "contact_email": "dispatch@xyztransport.com"}
        ]
        customer_result = await db.customers.insert_many(customers)
        customer_ids = [str(id) for id in customer_result.inserted_ids]
        
        # Create demo vehicles
        vehicles = [
            {"customer_id": customer_ids[0], "vin": "1FTFW1ET5DFA12345", "year": 2020, "make": "Freightliner", "model": "Cascadia"},
            {"customer_id": customer_ids[0], "vin": "1FVACWDT6CHBP7865", "year": 2019, "make": "Freightliner", "model": "M2"},
            {"customer_id": customer_ids[1], "vin": "3HSDJAPR7CN622456", "year": 2021, "make": "International", "model": "LT"}
        ]
        vehicle_result = await db.vehicles.insert_many(vehicles)
        vehicle_ids = [str(id) for id in vehicle_result.inserted_ids]
        
        # Create demo service orders
        service_orders = [
            {
                "number": "2025-00001",
                "customer_id": customer_ids[0],
                "vehicle_id": vehicle_ids[0],
                "complaint": "Engine check light on, loss of power",
                "service_type": "shop",
                "urgency": "high",
                "status": "tech_assigned",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "created_by": current_user["id"],
                "updated_by": current_user["id"],
                "tracker_public_token": "demo1234567890abcdef1234567890ab",
                "tracker_events": [
                    {
                        "status": "service_requested",
                        "timestamp": datetime.utcnow(),
                        "user_id": current_user["id"]
                    },
                    {
                        "status": "tech_assigned",
                        "timestamp": datetime.utcnow(),
                        "user_id": current_user["id"]
                    }
                ]
            },
            {
                "number": "2025-00002",
                "customer_id": customer_ids[1],
                "vehicle_id": vehicle_ids[2],
                "complaint": "Air leak from brake system",
                "service_type": "shop",
                "urgency": "normal",
                "status": "service_requested",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "created_by": current_user["id"],
                "updated_by": current_user["id"],
                "tracker_public_token": uuid4().hex,
                "tracker_events": [
                    {
                        "status": "service_requested",
                        "timestamp": datetime.utcnow(),
                        "user_id": current_user["id"]
                    }
                ]
            }
        ]
        await db.service_orders.insert_many(service_orders)
        
        return {
            "message": "Demo data created successfully",
            "customers": len(customer_ids),
            "vehicles": len(vehicle_ids),
            "service_orders": len(service_orders)
        }
    except Exception as e:
        logger.error(f"Error creating demo data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create demo data: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)
