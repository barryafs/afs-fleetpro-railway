"""
AFS FleetPro Portal API
Customer-facing API for service tracking and customer portal
"""

from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
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
logger = logging.getLogger("portal-api")

# Create FastAPI app
app = FastAPI(
    title="AFS FleetPro Portal API",
    description="Customer-facing API for AFS FleetPro",
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

# Models
class VehicleResponse(BaseModel):
    id: str
    vin: str
    year: int
    make: str
    model: str

class TrackerEvent(BaseModel):
    status: str
    timestamp: datetime
    notes: Optional[str] = None

class TrackerResponse(BaseModel):
    service_order_number: str
    vehicle: Dict[str, Any]
    customer: Dict[str, Any]
    status: str
    eta: Optional[str] = None
    technician: Optional[str] = None
    events: List[Dict[str, Any]]

class CustomerAuthRequest(BaseModel):
    email: str
    password: str  # In production, use proper authentication

class CustomerResponse(BaseModel):
    id: str
    name: str
    email: str
    token: str  # JWT token for authentication

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
        # `db` is a Motor database object.  It does not implement truth-value
        # testing, so we must explicitly compare against ``None``.
        if db is not None:
            await db.command("ping")
            return {"status": "ok", "service": "portal-api", "database": "connected"}
        return {"status": "ok", "service": "portal-api", "database": "not connected"}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "service": "portal-api", "message": str(e)}
        )

# Simplified auth for demo - in production use proper JWT
async def get_current_customer(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # In production, validate JWT here
    # For demo, just return a mock customer
    return {"id": "demo-customer", "name": "Acme Logistics"}

# Public tracker endpoint - no auth required
@app.get("/portal/v1/tracker/{token}")
async def get_tracker(token: str):
    try:
        # Find service order by tracker token
        service_order = await db.service_orders.find_one({"tracker_public_token": token})
        if not service_order:
            # Special case for demo token
            if token == "demo1234567890abcdef1234567890ab":
                return {
                    "service_order_number": "2025-00001",
                    "vehicle": {
                        "year": 2020,
                        "make": "Freightliner",
                        "model": "Cascadia",
                        "vin": "1FTFW1ET5DFA12345"
                    },
                    "customer": {
                        "name": "Acme Logistics"
                    },
                    "status": "tech_assigned",
                    "eta": "2 hours",
                    "technician": "John Smith",
                    "events": [
                        {"status": "service_requested", "timestamp": "2025-07-23T10:00:00Z"},
                        {"status": "tech_assigned", "timestamp": "2025-07-23T10:15:00Z"}
                    ]
                }
            raise HTTPException(status_code=404, detail="Tracker not found")
            
        # Get vehicle and customer info
        from bson.objectid import ObjectId
        
        vehicle = await db.vehicles.find_one({"_id": ObjectId(service_order["vehicle_id"])})
        customer = await db.customers.find_one({"_id": ObjectId(service_order["customer_id"])})
        
        if not vehicle or not customer:
            raise HTTPException(status_code=500, detail="Vehicle or customer data missing")
            
        # Format response
        tracker_response = {
            "service_order_number": service_order["number"],
            "vehicle": {
                "year": vehicle["year"],
                "make": vehicle["make"],
                "model": vehicle["model"],
                "vin": vehicle["vin"]
            },
            "customer": {
                "name": customer["name"]
            },
            "status": service_order["status"],
            "events": service_order.get("tracker_events", [])
        }
        
        # Add ETA if available
        if "eta" in service_order:
            tracker_response["eta"] = service_order["eta"]
            
        # Add technician if assigned
        if "technician_name" in service_order:
            tracker_response["technician"] = service_order["technician_name"]
            
        return tracker_response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tracker: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get tracker: {str(e)}")

# Customer auth endpoint
@app.post("/portal/v1/auth", response_model=CustomerResponse)
async def customer_login(auth_request: CustomerAuthRequest):
    try:
        # In production, validate credentials against database
        # For demo, just return a mock token
        
        # Check if customer exists (simplified)
        customer = await db.customers.find_one({"contact_email": auth_request.email})
        if not customer:
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
        # In production, validate password here
        
        # Generate JWT token (simplified)
        token = "demo-jwt-token"
        
        return {
            "id": str(customer["_id"]),
            "name": customer["name"],
            "email": customer["contact_email"],
            "token": token
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

# Customer vehicles endpoint
@app.get("/portal/v1/vehicles")
async def list_customer_vehicles(current_customer: Dict = Depends(get_current_customer)):
    try:
        # Get customer vehicles
        vehicles = []
        async for vehicle in db.vehicles.find({"customer_id": current_customer["id"]}):
            vehicle["id"] = str(vehicle.pop("_id"))
            vehicles.append(vehicle)
            
        return vehicles
    except Exception as e:
        logger.error(f"Error listing vehicles: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list vehicles: {str(e)}")

# Customer service orders endpoint
@app.get("/portal/v1/service-orders")
async def list_customer_service_orders(
    status: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    current_customer: Dict = Depends(get_current_customer)
):
    try:
        # Build filter
        filter_query = {"customer_id": current_customer["id"]}
        if status:
            filter_query["status"] = status
        if vehicle_id:
            filter_query["vehicle_id"] = vehicle_id
            
        # Query database
        service_orders = []
        async for so in db.service_orders.find(filter_query).sort("created_at", -1):
            so["id"] = str(so.pop("_id"))
            service_orders.append(so)
            
        return service_orders
    except Exception as e:
        logger.error(f"Error listing service orders: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list service orders: {str(e)}")

# Service request endpoint
@app.post("/portal/v1/service-requests")
async def create_service_request(
    request_data: Dict[str, Any],
    current_customer: Dict = Depends(get_current_customer)
):
    try:
        # Validate required fields
        required_fields = ["vehicle_id", "complaint", "contact_phone"]
        for field in required_fields:
            if field not in request_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
                
        # Create service request
        service_request = {
            "customer_id": current_customer["id"],
            "vehicle_id": request_data["vehicle_id"],
            "complaint": request_data["complaint"],
            "contact_phone": request_data["contact_phone"],
            "status": "pending_review",
            "created_at": datetime.utcnow()
        }
        
        # Add optional fields
        optional_fields = ["preferred_date", "preferred_time", "notes"]
        for field in optional_fields:
            if field in request_data:
                service_request[field] = request_data[field]
                
        # Insert into database
        result = await db.service_requests.insert_one(service_request)
        service_request["id"] = str(result.inserted_id)
        
        # Notify shop (simplified)
        logger.info(f"New service request created: {service_request['id']}")
        
        return {
            "message": "Service request submitted successfully",
            "request_id": service_request["id"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating service request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create service request: {str(e)}")

# Payments endpoint (simplified)
@app.get("/portal/v1/invoices")
async def list_customer_invoices(current_customer: Dict = Depends(get_current_customer)):
    try:
        # Get customer invoices
        invoices = []
        async for invoice in db.invoices.find({"customer_id": current_customer["id"]}):
            invoice["id"] = str(invoice.pop("_id"))
            invoices.append(invoice)
            
        return invoices
    except Exception as e:
        logger.error(f"Error listing invoices: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list invoices: {str(e)}")

# Create payment intent (simplified)
@app.post("/portal/v1/payments")
async def create_payment(
    payment_data: Dict[str, Any],
    current_customer: Dict = Depends(get_current_customer)
):
    try:
        # Validate required fields
        required_fields = ["invoice_id", "amount"]
        for field in required_fields:
            if field not in payment_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
                
        # In production, integrate with Stripe or other payment processor
        # For demo, just return a success response
        
        return {
            "message": "Payment processed successfully",
            "transaction_id": "demo-transaction-123",
            "amount": payment_data["amount"],
            "status": "completed"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing payment: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process payment: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)
