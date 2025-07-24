"""
AFS FleetPro Internal API
Core shop management API for internal staff
"""

from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, timedelta
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

# ---------------------------------------------------------------------------
# CORS configuration
# ---------------------------------------------------------------------------
# The frontend hosted on Railway needs to talk to this API.  We build the list
# of allowed origins from the `CORS_ORIGINS` env-var, but fall back to a safe
# default that includes the production frontend domain and common local dev
# ports.  This helps avoid the dreaded "Network Error" caused by blocked CORS.
cors_origins = os.environ.get(
    "CORS_ORIGINS",
    "https://frontend-production-3e4a.up.railway.app,"
    "http://localhost:5173,"
    "http://localhost:3000"
).split(",")

# Log the CORS origins so we can verify in Railway logs
logger.info(f"Allowed CORS origins: {cors_origins}")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# Root endpoint (`GET /`) – simple response for platform health-checks
# ------------------------------------------------------------------------------

@app.get("/", tags=["System"])
async def root() -> Dict[str, str]:
    """
    Lightweight OK response so that infrastructure (e.g., Railway) probing the
    root path gets a valid answer instead of a 404.  This **does not** require
    DB connectivity and therefore responds even during cold-starts.
    """
    return {"status": "ok", "service": "internal-api"}

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
# ---------------------------------------------------------------------------#
# New / Extended  Industry-Standard Models                                  #
# ---------------------------------------------------------------------------#

# ── Technicians assigned to an Action Item ────────────────────────────────

class TechnicianAssignment(BaseModel):
    tech_id: str = Field(..., description="Technician ID")
    percentage: int = Field(..., ge=1, le=100)
    is_lead: bool = False

# ── Line-items (labor / part / fee) ───────────────────────────────────────

class LineItem(BaseModel):
    # Pydantic v2 changed regex handling; keep simple description instead
    type: str = Field(
        ...,
        description="Line-item type: labor, part, or fee",
    )
    description: str
    # Labor
    hours: Optional[float] = None
    rate: Optional[float] = None
    technician_id: Optional[str] = None
    # Parts
    part_number: Optional[str] = None
    quantity: Optional[int] = 1
    cost: Optional[float] = None
    price: Optional[float] = None
    is_core: Optional[bool] = False
    core_charge: Optional[float] = None

# ── Action Item following the 3 C's ───────────────────────────────────────

class ActionItem(BaseModel):
    id: Optional[str] = None
    title: str
    complaint: str
    cause: Optional[str] = None
    correction: Optional[str] = None
    status: str = "pending"          # pending / in_progress / completed
    assigned_technicians: List[TechnicianAssignment] = []
    line_items: List[LineItem] = []

# Action Item Create/Update models
class ActionItemCreate(BaseModel):
    title: str
    complaint: str = Field(..., description="Required - 1st C of the 3 C's")
    cause: Optional[str] = Field(None, description="2nd C of the 3 C's")
    correction: Optional[str] = Field(None, description="3rd C of the 3 C's")
    status: str = "pending"
    assigned_technicians: List[TechnicianAssignment] = []
    line_items: List[LineItem] = []

class ActionItemUpdate(BaseModel):
    title: Optional[str] = None
    complaint: Optional[str] = None
    cause: Optional[str] = None
    correction: Optional[str] = None
    status: Optional[str] = None
    assigned_technicians: Optional[List[TechnicianAssignment]] = None
    line_items: Optional[List[LineItem]] = None

# ---------------------------------------------------------------------------#
# Service Order Container – new required fields                              #
# ---------------------------------------------------------------------------#

class LocationInfo(BaseModel):
    current_address: str
    location_name: Optional[str] = None
    cross_streets: Optional[str] = None
    gps_coordinates: Optional[Dict[str, float]] = None

class ComplaintInput(BaseModel):
    id: int
    description: str
    photos: List[str] = []


class ServiceOrderCreate(BaseModel):
    customer_id: str
    vehicle_id: str

    # Vehicle readings
    current_mileage: Optional[int] = None
    current_hours: Optional[int] = None

    # Service meta
    service_type: str = "shop_service"               # shop_service / mobile_service / roadside_emergency
    initial_assessment: Optional[str] = None

    # Complaints – replaces old single complaint field
    complaints: List[ComplaintInput] = Field(..., min_items=1, max_items=10)

    # Location (required for mobile/roadside)
    vehicle_location: Optional[LocationInfo] = None

    # Action items may be added later – start empty
    action_items: List[ActionItem] = []

    urgency: str = "normal"
    
class ServiceOrderUpdate(BaseModel):
    # Allow updating complaints or adding new ones
    complaints: Optional[List[ComplaintInput]] = None

    # Allow updating high-level fields
    current_mileage: Optional[int] = None
    current_hours: Optional[int] = None
    initial_assessment: Optional[str] = None
    status: Optional[str] = None

    # Allow patching action items list (full replacement for now)
    action_items: Optional[List[ActionItem]] = None

    # Legacy fields kept for compatibility (to be removed later)
    complaint: Optional[str] = None
    cause: Optional[str] = None
    correction: Optional[str] = None
    technician_ids: Optional[List[str]] = None

class ServiceOrderResponse(BaseModel):
    id: str
    number: str
    customer_id: str
    vehicle_id: str
    status: str

    # New container fields
    current_mileage: Optional[int] = None
    current_hours: Optional[int] = None
    service_type: str
    initial_assessment: Optional[str] = None
    complaints: List[ComplaintInput]
    vehicle_location: Optional[LocationInfo] = None
    action_items: List[ActionItem] = []

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
        # Requirements: 5-digit sequential number with **no** year prefix
        # Example: "00001", "00002", …
        so_number = f"{count + 1:05d}"
        # Convert incoming Pydantic model to dict (deep copy)
        new_so = service_order.dict()

        # Append system-generated fields
        new_so.update(
            {
                "number": so_number,
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
                        "user_id": current_user["id"],
                    }
                ],
            }
        )
        
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

# ---------------------------------------------------------------------------
# DELETE /internal/v1/service-orders/{service_order_id}
# ---------------------------------------------------------------------------

# Placed here so that it sits logically with other Service Order CRUD routes,
# right after the PATCH status endpoint and before demo utilities.

@app.delete("/internal/v1/service-orders/{service_order_id}")
async def delete_service_order(
    service_order_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Permanently delete a service order.  This **does not** cascade to related
    data (e.g. messages) in this simplified demo implementation.
    """
    from bson.objectid import ObjectId

    try:
        result = await db.service_orders.delete_one({"_id": ObjectId(service_order_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Service order not found")

        logger.info(f"Service order deleted: {service_order_id}")
        return {"message": "Service order deleted"}

    except HTTPException:
        # Re-raise FastAPI HTTP exceptions untouched
        raise
    except Exception as e:
        logger.error(f"Error deleting service order: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete service order: {str(e)}")

# =============================================================================
# Action Items CRUD
# =============================================================================

# Create action item
@app.post("/internal/v1/service-orders/{service_order_id}/action-items", response_model=ActionItem)
async def create_action_item(
    service_order_id: str,
    action_item: ActionItemCreate,
    current_user: Dict = Depends(get_current_user)
):
    """
    Create a new action item for a service order.
    
    Action items follow the 3 C's structure (Complaint, Cause, Correction).
    At minimum, the Complaint field is required at creation.
    """
    try:
        from bson.objectid import ObjectId
        
        # Check if service order exists
        service_order = await db.service_orders.find_one({"_id": ObjectId(service_order_id)})
        if not service_order:
            raise HTTPException(status_code=404, detail="Service order not found")
        
        # Create new action item with generated ID
        new_action_item = action_item.dict()
        new_action_item["id"] = str(uuid4())  # Generate unique ID for action item
        new_action_item["created_at"] = datetime.utcnow()
        new_action_item["updated_at"] = datetime.utcnow()
        new_action_item["created_by"] = current_user["id"]
        new_action_item["updated_by"] = current_user["id"]
        
        # Add action item to service order
        result = await db.service_orders.update_one(
            {"_id": ObjectId(service_order_id)},
            {
                "$push": {"action_items": new_action_item},
                "$set": {"updated_at": datetime.utcnow(), "updated_by": current_user["id"]}
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to add action item")
        
        # Log the action
        logger.info(f"Action item created: {new_action_item['id']} for service order: {service_order_id}")
        
        return new_action_item
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating action item: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create action item: {str(e)}")

# List action items for a service order
@app.get("/internal/v1/service-orders/{service_order_id}/action-items", response_model=List[ActionItem])
async def list_action_items(
    service_order_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    List all action items for a specific service order.
    """
    try:
        from bson.objectid import ObjectId
        
        # Get service order
        service_order = await db.service_orders.find_one(
            {"_id": ObjectId(service_order_id)},
            {"action_items": 1}
        )
        
        if not service_order:
            raise HTTPException(status_code=404, detail="Service order not found")
        
        # Return action items (or empty list if none exist)
        return service_order.get("action_items", [])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing action items: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list action items: {str(e)}")

# Get single action item
@app.get("/internal/v1/action-items/{action_item_id}", response_model=ActionItem)
async def get_action_item(
    action_item_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Get a specific action item by its ID.
    
    This endpoint searches across all service orders to find the action item.
    """
    try:
        # Find service order containing the action item
        service_order = await db.service_orders.find_one(
            {"action_items.id": action_item_id},
            {"action_items.$": 1}  # MongoDB projection to return only the matching action item
        )
        
        if not service_order or "action_items" not in service_order or not service_order["action_items"]:
            raise HTTPException(status_code=404, detail="Action item not found")
        
        # Return the found action item
        return service_order["action_items"][0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting action item: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get action item: {str(e)}")

# Update action item
@app.patch("/internal/v1/action-items/{action_item_id}", response_model=ActionItem)
async def update_action_item(
    action_item_id: str,
    action_item: ActionItemUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """
    Update an action item by its ID.
    
    This endpoint allows updating any field of an action item, including the 3 C's.
    """
    try:
        # Build update document from non-null fields
        update_data = {k: v for k, v in action_item.dict().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Add metadata
        update_data["updated_at"] = datetime.utcnow()
        update_data["updated_by"] = current_user["id"]
        
        # Build the MongoDB update operation for a nested document
        update_operations = {}
        for field, value in update_data.items():
            update_operations[f"action_items.$.{field}"] = value
        
        # Update the action item within the service order
        result = await db.service_orders.update_one(
            {"action_items.id": action_item_id},
            {
                "$set": update_operations,
                "$set": {"updated_at": datetime.utcnow(), "updated_by": current_user["id"]}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Action item not found")
        
        if result.modified_count == 0:
            # Document was found but not modified (might be same data)
            logger.info(f"Action item update had no effect: {action_item_id}")
        else:
            logger.info(f"Action item updated: {action_item_id}")
        
        # Get the updated action item
        service_order = await db.service_orders.find_one(
            {"action_items.id": action_item_id},
            {"action_items.$": 1}
        )
        
        if not service_order or "action_items" not in service_order or not service_order["action_items"]:
            raise HTTPException(status_code=404, detail="Action item not found after update")
        
        return service_order["action_items"][0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating action item: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update action item: {str(e)}")

# Delete action item
@app.delete("/internal/v1/action-items/{action_item_id}")
async def delete_action_item(
    action_item_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Delete an action item by its ID.
    
    This removes the action item from its parent service order.
    """
    try:
        # Find and remove the action item from its service order
        result = await db.service_orders.update_one(
            {"action_items.id": action_item_id},
            {
                "$pull": {"action_items": {"id": action_item_id}},
                "$set": {"updated_at": datetime.utcnow(), "updated_by": current_user["id"]}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Action item not found")
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to delete action item")
        
        logger.info(f"Action item deleted: {action_item_id}")
        return {"message": "Action item deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting action item: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete action item: {str(e)}")

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
            {"name": "Acme Logistics", "contact_email": "fleet@acmelogistics.com", "contact_phone": "214-555-7890"},
            {"name": "XYZ Transport", "contact_email": "dispatch@xyztransport.com", "contact_phone": "972-555-1234"}
        ]
        customer_result = await db.customers.insert_many(customers)
        customer_ids = [str(id) for id in customer_result.inserted_ids]
        
        # Create demo vehicles
        vehicles = [
            {
                "customer_id": customer_ids[0],
                "vin": "1FTFW1ET5DFA12345",
                "year": 2020,
                "make": "Freightliner",
                "model": "Cascadia"
            },
            {
                "customer_id": customer_ids[0],
                "vin": "1FVACWDT6CHBP7865",
                "year": 2019,
                "make": "Freightliner",
                "model": "M2"
            },
            {
                "customer_id": customer_ids[1],
                "vin": "3HSDJAPR7CN622456",
                "year": 2021,
                "make": "International",
                "model": "LT"
            }
        ]
        vehicle_result = await db.vehicles.insert_many(vehicles)
        vehicle_ids = [str(id) for id in vehicle_result.inserted_ids]
        
        # Create demo technicians
        technicians = [
            {"name": "John Smith", "email": "jsmith@afsfleetpro.com", "specialty": "Diesel Engine"},
            {"name": "Maria Rodriguez", "email": "mrodriguez@afsfleetpro.com", "specialty": "Electrical"},
            {"name": "David Chen", "email": "dchen@afsfleetpro.com", "specialty": "Transmission"}
        ]
        technician_result = await db.technicians.insert_many(technicians)
        technician_ids = [str(id) for id in technician_result.inserted_ids]
        
        # Create demo service orders with new structure
        service_orders = [
            {
                "number": "00001",
                "customer_id": customer_ids[0],
                "vehicle_id": vehicle_ids[0],
                "current_mileage": 285000,
                "service_type": "shop_service",
                "initial_assessment": "Possible turbo or EGR issue",
                "urgency": "high",
                "status": "tech_assigned",
                "complaints": [
                    {
                        "id": 1,
                        "description": "Engine lacks power when pulling heavy loads",
                        "photos": ["complaint_1_photo_1.jpg"]
                    },
                    {
                        "id": 2,
                        "description": "Black smoke from exhaust during acceleration",
                        "photos": []
                    },
                    {
                        "id": 3,
                        "description": "Check engine light on",
                        "photos": ["cel_photo.jpg"]
                    }
                ],
                "action_items": [
                    {
                        "id": str(uuid4()),
                        "title": "Turbocharger Replacement",
                        "complaint": "Engine lacks power when loaded, black smoke from exhaust",
                        "cause": "Turbocharger vanes stuck due to carbon buildup, boost pressure below spec",
                        "correction": "Replaced turbocharger with remanufactured unit, cleaned intake system, verified boost pressure at 35 PSI",
                        "status": "in_progress",
                        "assigned_technicians": [
                            {
                                "tech_id": technician_ids[0],
                                "percentage": 60,
                                "is_lead": True
                            },
                            {
                                "tech_id": technician_ids[1],
                                "percentage": 40,
                                "is_lead": False
                            }
                        ],
                        "line_items": [
                            {
                                "type": "labor",
                                "description": "R&R Turbocharger",
                                "hours": 4.0,
                                "rate": 125.00,
                                "technician_id": technician_ids[0]
                            },
                            {
                                "type": "part",
                                "part_number": "HX55W",
                                "description": "Turbocharger Assembly - Reman",
                                "quantity": 1,
                                "cost": 850.00,
                                "price": 1955.00,
                                "is_core": True,
                                "core_charge": 500.00
                            },
                            {
                                "type": "part",
                                "part_number": "TK-1234",
                                "description": "Turbo Mounting Gasket Kit",
                                "quantity": 1,
                                "cost": 45.00,
                                "price": 103.50
                            }
                        ],
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "created_by": current_user["id"],
                        "updated_by": current_user["id"]
                    },
                    {
                        "id": str(uuid4()),
                        "title": "Check Engine Light Diagnostics",
                        "complaint": "Check engine light on",
                        "cause": "DTC P0299 - Turbo underboost condition",
                        "correction": "Cleared codes after turbo replacement, verified no codes return after test drive",
                        "status": "pending",
                        "assigned_technicians": [
                            {
                                "tech_id": technician_ids[1],
                                "percentage": 100,
                                "is_lead": True
                            }
                        ],
                        "line_items": [
                            {
                                "type": "labor",
                                "description": "Diagnostic Scan & Clear Codes",
                                "hours": 0.5,
                                "rate": 125.00,
                                "technician_id": technician_ids[1]
                            }
                        ],
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "created_by": current_user["id"],
                        "updated_by": current_user["id"]
                    }
                ],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "created_by": current_user["id"],
                "updated_by": current_user["id"],
                "tracker_public_token": "demo1234567890abcdef1234567890ab",
                "tracker_events": [
                    {
                        "status": "service_requested",
                        "timestamp": datetime.utcnow() - timedelta(hours=2),
                        "user_id": current_user["id"]
                    },
                    {
                        "status": "tech_assigned",
                        "timestamp": datetime.utcnow() - timedelta(hours=1),
                        "user_id": current_user["id"]
                    }
                ]
            },
            {
                "number": "00002",
                "customer_id": customer_ids[1],
                "vehicle_id": vehicle_ids[2],
                "current_mileage": 178500,
                "service_type": "mobile_service",
                "initial_assessment": "Air leak at gladhand connection, possible brake chamber issue",
                "urgency": "critical",
                "status": "service_requested",
                "complaints": [
                    {
                        "id": 1,
                        "description": "Air leak from brake system",
                        "photos": []
                    },
                    {
                        "id": 2,
                        "description": "Low air pressure warning light",
                        "photos": ["air_pressure_gauge.jpg"]
                    }
                ],
                "vehicle_location": {
                    "current_address": "1234 Industrial Blvd, Dallas, TX 75201",
                    "location_name": "Customer's North Dallas Yard",
                    "cross_streets": "Industrial and Commerce",
                    "gps_coordinates": {"lat": 32.7767, "lng": -96.7970}
                },
                "action_items": [
                    {
                        "id": str(uuid4()),
                        "title": "Air System Inspection",
                        "complaint": "Air leak from brake system, low air pressure warning",
                        "cause": "Pending diagnosis",
                        "status": "pending",
                        "assigned_technicians": [
                            {
                                "tech_id": technician_ids[2],
                                "percentage": 100,
                                "is_lead": True
                            }
                        ],
                        "line_items": [
                            {
                                "type": "labor",
                                "description": "Mobile Service Call - Air System Diagnosis",
                                "hours": 1.5,
                                "rate": 150.00,
                                "technician_id": technician_ids[2]
                            }
                        ],
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "created_by": current_user["id"],
                        "updated_by": current_user["id"]
                    }
                ],
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
            },
            {
                "number": "00003",
                "customer_id": customer_ids[0],
                "vehicle_id": vehicle_ids[1],
                "current_mileage": 142300,
                "current_hours": 8500,
                "service_type": "shop_service",
                "initial_assessment": "Routine maintenance, possible hydraulic pump issue",
                "urgency": "normal",
                "status": "service_requested",
                "complaints": [
                    {
                        "id": 1,
                        "description": "Due for routine maintenance (oil, filters)",
                        "photos": []
                    },
                    {
                        "id": 2,
                        "description": "Hydraulic pump making noise when operating",
                        "photos": ["hydraulic_pump.jpg"]
                    }
                ],
                "action_items": [
                    {
                        "id": str(uuid4()),
                        "title": "Preventive Maintenance Service",
                        "complaint": "Due for routine maintenance (oil, filters)",
                        "cause": "Regular maintenance interval reached",
                        "correction": "Pending service",
                        "status": "pending",
                        "line_items": [
                            {
                                "type": "labor",
                                "description": "PM Service - Level A",
                                "hours": 2.5,
                                "rate": 125.00
                            },
                            {
                                "type": "part",
                                "part_number": "LF9080",
                                "description": "Oil Filter",
                                "quantity": 1,
                                "cost": 15.75,
                                "price": 36.22
                            },
                            {
                                "type": "part",
                                "part_number": "FL1995",
                                "description": "Fuel Filter",
                                "quantity": 2,
                                "cost": 12.50,
                                "price": 28.75
                            },
                            {
                                "type": "part",
                                "part_number": "15W40-5G",
                                "description": "15W-40 Engine Oil",
                                "quantity": 3,
                                "cost": 18.00,
                                "price": 41.40
                            }
                        ],
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "created_by": current_user["id"],
                        "updated_by": current_user["id"]
                    },
                    {
                        "id": str(uuid4()),
                        "title": "Hydraulic Pump Inspection",
                        "complaint": "Hydraulic pump making noise when operating",
                        "cause": "Pending diagnosis",
                        "status": "pending",
                        "line_items": [
                            {
                                "type": "labor",
                                "description": "Hydraulic System Diagnosis",
                                "hours": 1.0,
                                "rate": 125.00
                            }
                        ],
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "created_by": current_user["id"],
                        "updated_by": current_user["id"]
                    }
                ],
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
            "technicians": len(technician_ids),
            "service_orders": len(service_orders)
        }
    except Exception as e:
        logger.error(f"Error creating demo data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create demo data: {str(e)}")

# =============================================================================
# Customers CRUD
# =============================================================================

# Pydantic models

class CustomerCreate(BaseModel):
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

class CustomerResponse(BaseModel):
    id: str
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

# List / Filter customers

@app.get("/internal/v1/customers", response_model=List[CustomerResponse])
async def list_customers(
    skip: int = 0,
    limit: int = 100,
    q: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    try:
        filter_query = {}
        if q:
            # Simple case-insensitive regex search on name
            filter_query["name"] = {"$regex": q, "$options": "i"}

        cursor = db.customers.find(filter_query).skip(skip).limit(limit).sort("name", 1)
        customers = []
        async for doc in cursor:
            doc["id"] = str(doc.pop("_id"))
            customers.append(doc)
        return customers
    except Exception as e:
        logger.error(f"Error listing customers: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list customers: {str(e)}")

# Get single customer

@app.get("/internal/v1/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str, current_user: Dict = Depends(get_current_user)):
    from bson.objectid import ObjectId
    try:
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        customer["id"] = str(customer.pop("_id"))
        return customer
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting customer: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get customer: {str(e)}")

# Create customer

@app.post("/internal/v1/customers", response_model=CustomerResponse)
async def create_customer(
    customer: CustomerCreate,
    current_user: Dict = Depends(get_current_user)
):
    try:
        customer_doc = customer.dict()
        result = await db.customers.insert_one(customer_doc)
        customer_doc["id"] = str(result.inserted_id)
        return customer_doc
    except Exception as e:
        logger.error(f"Error creating customer: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create customer: {str(e)}")

# Update customer

@app.patch("/internal/v1/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    customer: CustomerUpdate,
    current_user: Dict = Depends(get_current_user)
):
    from bson.objectid import ObjectId
    try:
        update_data = {k: v for k, v in customer.dict().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        await db.customers.update_one({"_id": ObjectId(customer_id)}, {"$set": update_data})
        updated = await db.customers.find_one({"_id": ObjectId(customer_id)})
        if not updated:
            raise HTTPException(status_code=404, detail="Customer not found")
        updated["id"] = str(updated.pop("_id"))
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating customer: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update customer: {str(e)}")

# Delete customer

@app.delete("/internal/v1/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: Dict = Depends(get_current_user)):
    from bson.objectid import ObjectId
    try:
        result = await db.customers.delete_one({"_id": ObjectId(customer_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        return {"message": "Customer deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting customer: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete customer: {str(e)}")

# =============================================================================
# Vehicles CRUD
# =============================================================================

class VehicleCreate(BaseModel):
    customer_id: str
    vin: str
    year: int
    make: str
    model: str

class VehicleUpdate(BaseModel):
    vin: Optional[str] = None
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None

class VehicleResponse(BaseModel):
    id: str
    customer_id: str
    vin: str
    year: int
    make: str
    model: str

# List vehicles (optional customer_id filter)

@app.get("/internal/v1/vehicles", response_model=List[VehicleResponse])
async def list_vehicles(
    skip: int = 0,
    limit: int = 200,
    customer_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    try:
        filter_query = {}
        if customer_id:
            filter_query["customer_id"] = customer_id
        cursor = db.vehicles.find(filter_query).skip(skip).limit(limit).sort("year", -1)
        vehicles = []
        async for doc in cursor:
            doc["id"] = str(doc.pop("_id"))
            vehicles.append(doc)
        return vehicles
    except Exception as e:
        logger.error(f"Error listing vehicles: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list vehicles: {str(e)}")

# Get vehicle

@app.get("/internal/v1/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(vehicle_id: str, current_user: Dict = Depends(get_current_user)):
    from bson.objectid import ObjectId
    try:
        vehicle = await db.vehicles.find_one({"_id": ObjectId(vehicle_id)})
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        vehicle["id"] = str(vehicle.pop("_id"))
        return vehicle
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting vehicle: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get vehicle: {str(e)}")

# Create vehicle

@app.post("/internal/v1/vehicles", response_model=VehicleResponse)
async def create_vehicle(vehicle: VehicleCreate, current_user: Dict = Depends(get_current_user)):
    try:
        doc = vehicle.dict()
        result = await db.vehicles.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        return doc
    except Exception as e:
        logger.error(f"Error creating vehicle: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create vehicle: {str(e)}")

# Update vehicle

@app.patch("/internal/v1/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: str,
    vehicle: VehicleUpdate,
    current_user: Dict = Depends(get_current_user)
):
    from bson.objectid import ObjectId
    try:
        update_data = {k: v for k, v in vehicle.dict().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        await db.vehicles.update_one({"_id": ObjectId(vehicle_id)}, {"$set": update_data})
        updated = await db.vehicles.find_one({"_id": ObjectId(vehicle_id)})
        if not updated:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        updated["id"] = str(updated.pop("_id"))
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating vehicle: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update vehicle: {str(e)}")

# Delete vehicle

@app.delete("/internal/v1/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, current_user: Dict = Depends(get_current_user)):
    from bson.objectid import ObjectId
    try:
        result = await db.vehicles.delete_one({"_id": ObjectId(vehicle_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        return {"message": "Vehicle deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting vehicle: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete vehicle: {str(e)}")

# =============================================================================
# Technicians (read-only for now)
# =============================================================================

class TechnicianResponse(BaseModel):
    id: str
    name: str
    email: Optional[str] = None

@app.get("/internal/v1/technicians", response_model=List[TechnicianResponse])
async def list_technicians(current_user: Dict = Depends(get_current_user)):
    try:
        cursor = db.technicians.find({}).sort("name", 1)
        technicians = []
        async for doc in cursor:
            doc["id"] = str(doc.pop("_id"))
            technicians.append(doc)
        return technicians
    except Exception as e:
        logger.error(f"Error listing technicians: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list technicians: {str(e)}")

@app.get("/internal/v1/technicians/{technician_id}", response_model=TechnicianResponse)
async def get_technician(technician_id: str, current_user: Dict = Depends(get_current_user)):
    from bson.objectid import ObjectId
    try:
        tech = await db.technicians.find_one({"_id": ObjectId(technician_id)})
        if not tech:
            raise HTTPException(status_code=404, detail="Technician not found")
        tech["id"] = str(tech.pop("_id"))
        return tech
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting technician: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get technician: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)
