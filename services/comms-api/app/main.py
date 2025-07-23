"""
AFS FleetPro Communications API
Omnichannel communication API with WebSocket support for real-time messaging
"""

from fastapi import FastAPI, Depends, HTTPException, Header, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any, Set
from datetime import datetime
import logging
import time
import os
import json
import asyncio
import motor.motor_asyncio
import redis.asyncio as redis
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(
    level=logging.getLevelName(os.environ.get("LOG_LEVEL", "INFO")),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("comms-api")

# Create FastAPI app
app = FastAPI(
    title="AFS FleetPro Communications API",
    description="Omnichannel communication API with WebSocket support",
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

# Redis connection
redis_client = None

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        # Map of conversation_id -> set of connected WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Map of user_id -> set of WebSockets
        self.user_connections: Dict[str, Set[WebSocket]] = {}
        
    async def connect(self, websocket: WebSocket, conversation_id: str, user_id: str):
        await websocket.accept()
        
        # Add to conversation connections
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = set()
        self.active_connections[conversation_id].add(websocket)
        
        # Add to user connections
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(websocket)
        
        logger.info(f"WebSocket connected: user_id={user_id}, conversation_id={conversation_id}")
        
    def disconnect(self, websocket: WebSocket, conversation_id: str, user_id: str):
        # Remove from conversation connections
        if conversation_id in self.active_connections:
            self.active_connections[conversation_id].discard(websocket)
            if not self.active_connections[conversation_id]:
                del self.active_connections[conversation_id]
        
        # Remove from user connections
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
                
        logger.info(f"WebSocket disconnected: user_id={user_id}, conversation_id={conversation_id}")
        
    async def broadcast_to_conversation(self, conversation_id: str, message: Dict[str, Any]):
        if conversation_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[conversation_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending WebSocket message: {str(e)}")
                    disconnected.add(connection)
            
            # Clean up disconnected clients
            for connection in disconnected:
                self.active_connections[conversation_id].discard(connection)
                
    async def send_to_user(self, user_id: str, message: Dict[str, Any]):
        if user_id in self.user_connections:
            disconnected = set()
            for connection in self.user_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending WebSocket message to user: {str(e)}")
                    disconnected.add(connection)
            
            # Clean up disconnected clients
            for connection in disconnected:
                self.user_connections[user_id].discard(connection)

# Create connection manager
manager = ConnectionManager()

# Models
class MessageCreate(BaseModel):
    content: str
    conversation_id: str
    sender_id: str
    sender_type: str = "user"  # user, customer, system
    message_type: str = "text"  # text, image, document, system
    metadata: Optional[Dict[str, Any]] = None

class MessageResponse(BaseModel):
    id: str
    content: str
    conversation_id: str
    sender_id: str
    sender_type: str
    message_type: str
    created_at: datetime
    read_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None

class ConversationCreate(BaseModel):
    customer_id: str
    service_order_id: Optional[str] = None
    title: Optional[str] = None
    participants: List[str] = []

class ConversationResponse(BaseModel):
    id: str
    customer_id: str
    service_order_id: Optional[str] = None
    title: str
    status: str
    created_at: datetime
    updated_at: datetime
    last_message: Optional[Dict[str, Any]] = None
    unread_count: int = 0

# Database connection events
@app.on_event("startup")
async def startup_db_client():
    global mongo_client, db, redis_client
    
    # Connect to MongoDB
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    mongo_client = motor.motor_asyncio.AsyncIOMotorClient(mongo_uri)
    db = mongo_client.afs_fleetpro
    logger.info("Connected to MongoDB")
    
    # Connect to Redis
    redis_uri = os.environ.get("REDIS_URI", "redis://localhost:6379/0")
    redis_client = redis.from_url(redis_uri)
    try:
        await redis_client.ping()
        logger.info("Connected to Redis")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {str(e)}")
        redis_client = None

@app.on_event("shutdown")
async def shutdown_db_client():
    global mongo_client, redis_client
    
    # Close MongoDB connection
    if mongo_client:
        mongo_client.close()
        logger.info("Disconnected from MongoDB")
    
    # Close Redis connection
    if redis_client:
        await redis_client.close()
        logger.info("Disconnected from Redis")

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
        # Check MongoDB connection
        mongo_status = "disconnected"
        if db:
            try:
                await db.command("ping")
                mongo_status = "connected"
            except Exception as e:
                logger.error(f"MongoDB health check failed: {str(e)}")
        
        # Check Redis connection
        redis_status = "disconnected"
        if redis_client:
            try:
                await redis_client.ping()
                redis_status = "connected"
            except Exception as e:
                logger.error(f"Redis health check failed: {str(e)}")
        
        return {
            "status": "ok", 
            "service": "comms-api", 
            "database": mongo_status,
            "redis": redis_status
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "service": "comms-api", "message": str(e)}
        )

# Simplified auth for demo - in production use proper JWT
async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        return {"id": "demo-user", "role": "admin"}
    # In production, validate JWT here
    return {"id": "demo-user", "role": "admin"}

# WebSocket endpoint for real-time messaging
@app.websocket("/comms/v1/ws/{conversation_id}")
async def websocket_endpoint(websocket: WebSocket, conversation_id: str, token: str = None):
    if not token:
        await websocket.close(code=1008, reason="Unauthorized")
        return
    
    # In production, validate token here
    # For demo, just use a mock user
    user_id = "demo-user"
    
    try:
        # Connect to WebSocket
        await manager.connect(websocket, conversation_id, user_id)
        
        # Subscribe to Redis channel for this conversation
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"conversation:{conversation_id}")
        
        # Create task for listening to Redis messages
        redis_task = asyncio.create_task(listen_to_redis(pubsub, websocket, conversation_id))
        
        try:
            # Listen for messages from client
            while True:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # Validate message
                if "content" not in message_data:
                    await websocket.send_json({"error": "Invalid message format"})
                    continue
                
                # Create message object
                message = {
                    "content": message_data["content"],
                    "conversation_id": conversation_id,
                    "sender_id": user_id,
                    "sender_type": "user",
                    "message_type": message_data.get("message_type", "text"),
                    "created_at": datetime.utcnow(),
                    "metadata": message_data.get("metadata", {})
                }
                
                # Save message to database
                result = await db.messages.insert_one(message)
                message["id"] = str(result.inserted_id)
                
                # Update conversation with last message
                await db.conversations.update_one(
                    {"_id": conversation_id},
                    {
                        "$set": {
                            "last_message": message,
                            "updated_at": datetime.utcnow()
                        },
                        "$inc": {"unread_count": 1}
                    }
                )
                
                # Publish to Redis for other connected clients
                if redis_client:
                    await redis_client.publish(
                        f"conversation:{conversation_id}",
                        json.dumps({
                            "type": "message",
                            "data": message
                        })
                    )
                
                # Send confirmation to sender
                await websocket.send_json({
                    "type": "message_sent",
                    "message_id": str(result.inserted_id)
                })
                
        except WebSocketDisconnect:
            # Cancel Redis listening task
            redis_task.cancel()
            try:
                await redis_task
            except asyncio.CancelledError:
                pass
            
            # Unsubscribe from Redis channel
            if pubsub:
                await pubsub.unsubscribe(f"conversation:{conversation_id}")
                await pubsub.close()
            
            # Disconnect WebSocket
            manager.disconnect(websocket, conversation_id, user_id)
            
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await websocket.close(code=1011, reason="Internal server error")

# Listen for Redis messages
async def listen_to_redis(pubsub, websocket: WebSocket, conversation_id: str):
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                await websocket.send_json(data)
    except asyncio.CancelledError:
        # Task was cancelled, exit gracefully
        pass
    except Exception as e:
        logger.error(f"Redis listener error: {str(e)}")

# REST endpoints for conversations
@app.post("/comms/v1/conversations", response_model=ConversationResponse)
async def create_conversation(
    conversation: ConversationCreate,
    current_user: Dict = Depends(get_current_user)
):
    try:
        # Create new conversation
        new_conversation = {
            "customer_id": conversation.customer_id,
            "service_order_id": conversation.service_order_id,
            "title": conversation.title or "New Conversation",
            "status": "open",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "created_by": current_user["id"],
            "participants": conversation.participants + [current_user["id"]],
            "unread_count": 0
        }
        
        result = await db.conversations.insert_one(new_conversation)
        new_conversation["id"] = str(result.inserted_id)
        
        # Create system message
        system_message = {
            "content": "Conversation started",
            "conversation_id": str(result.inserted_id),
            "sender_id": "system",
            "sender_type": "system",
            "message_type": "system",
            "created_at": datetime.utcnow()
        }
        
        await db.messages.insert_one(system_message)
        
        # Update conversation with last message
        new_conversation["last_message"] = system_message
        
        return new_conversation
    except Exception as e:
        logger.error(f"Error creating conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create conversation: {str(e)}")

@app.get("/comms/v1/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    customer_id: Optional[str] = None,
    service_order_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    try:
        # Build filter
        filter_query = {}
        if customer_id:
            filter_query["customer_id"] = customer_id
        if service_order_id:
            filter_query["service_order_id"] = service_order_id
        if status:
            filter_query["status"] = status
            
        # Query database
        conversations = []
        async for conversation in db.conversations.find(filter_query).sort("updated_at", -1):
            conversation["id"] = str(conversation.pop("_id"))
            conversations.append(conversation)
            
        return conversations
    except Exception as e:
        logger.error(f"Error listing conversations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list conversations: {str(e)}")

@app.get("/comms/v1/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    current_user: Dict = Depends(get_current_user)
):
    try:
        from bson.objectid import ObjectId
        
        conversation = await db.conversations.find_one({"_id": ObjectId(conversation_id)})
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
            
        conversation["id"] = str(conversation.pop("_id"))
        return conversation
    except Exception as e:
        logger.error(f"Error getting conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get conversation: {str(e)}")

@app.get("/comms/v1/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(
    conversation_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    try:
        from bson.objectid import ObjectId
        
        # Build filter
        filter_query = {"conversation_id": conversation_id}
        if before:
            filter_query["_id"] = {"$lt": ObjectId(before)}
            
        # Query database
        messages = []
        async for message in db.messages.find(filter_query).sort("_id", -1).limit(limit):
            message["id"] = str(message.pop("_id"))
            messages.append(message)
            
        # Mark messages as read
        await db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"unread_count": 0}}
        )
        
        return messages
    except Exception as e:
        logger.error(f"Error getting conversation messages: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get conversation messages: {str(e)}")

@app.post("/comms/v1/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def create_message(
    conversation_id: str,
    message: MessageCreate,
    current_user: Dict = Depends(get_current_user)
):
    try:
        from bson.objectid import ObjectId
        
        # Check if conversation exists
        conversation = await db.conversations.find_one({"_id": ObjectId(conversation_id)})
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
            
        # Create message object
        new_message = {
            "content": message.content,
            "conversation_id": conversation_id,
            "sender_id": current_user["id"],
            "sender_type": message.sender_type,
            "message_type": message.message_type,
            "created_at": datetime.utcnow(),
            "metadata": message.metadata or {}
        }
        
        # Save message to database
        result = await db.messages.insert_one(new_message)
        new_message["id"] = str(result.inserted_id)
        
        # Update conversation with last message
        await db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {
                "$set": {
                    "last_message": new_message,
                    "updated_at": datetime.utcnow()
                },
                "$inc": {"unread_count": 1}
            }
        )
        
        # Publish to Redis for connected WebSocket clients
        if redis_client:
            await redis_client.publish(
                f"conversation:{conversation_id}",
                json.dumps({
                    "type": "message",
                    "data": new_message
                })
            )
        
        # Broadcast to connected WebSocket clients
        await manager.broadcast_to_conversation(
            conversation_id,
            {
                "type": "message",
                "data": new_message
            }
        )
        
        return new_message
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create message: {str(e)}")

# Notifications endpoints
@app.post("/comms/v1/notifications")
async def create_notification(
    notification_data: Dict[str, Any],
    current_user: Dict = Depends(get_current_user)
):
    try:
        # Validate required fields
        required_fields = ["user_id", "type", "content"]
        for field in required_fields:
            if field not in notification_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
                
        # Create notification
        notification = {
            "user_id": notification_data["user_id"],
            "type": notification_data["type"],
            "content": notification_data["content"],
            "created_at": datetime.utcnow(),
            "read": False
        }
        
        # Add optional fields
        optional_fields = ["link", "metadata"]
        for field in optional_fields:
            if field in notification_data:
                notification[field] = notification_data[field]
                
        # Save to database
        result = await db.notifications.insert_one(notification)
        notification["id"] = str(result.inserted_id)
        
        # Send to user via WebSocket if connected
        await manager.send_to_user(
            notification["user_id"],
            {
                "type": "notification",
                "data": notification
            }
        )
        
        return notification
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating notification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create notification: {str(e)}")

@app.get("/comms/v1/notifications")
async def list_notifications(
    unread_only: bool = False,
    current_user: Dict = Depends(get_current_user)
):
    try:
        # Build filter
        filter_query = {"user_id": current_user["id"]}
        if unread_only:
            filter_query["read"] = False
            
        # Query database
        notifications = []
        async for notification in db.notifications.find(filter_query).sort("created_at", -1).limit(50):
            notification["id"] = str(notification.pop("_id"))
            notifications.append(notification)
            
        return notifications
    except Exception as e:
        logger.error(f"Error listing notifications: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list notifications: {str(e)}")

@app.patch("/comms/v1/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: Dict = Depends(get_current_user)
):
    try:
        from bson.objectid import ObjectId
        
        # Update notification
        result = await db.notifications.update_one(
            {"_id": ObjectId(notification_id), "user_id": current_user["id"]},
            {"$set": {"read": True}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
            
        return {"message": "Notification marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking notification as read: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to mark notification as read: {str(e)}")

# Demo data endpoint
@app.post("/comms/v1/demo-data")
async def create_demo_data(current_user: Dict = Depends(get_current_user)):
    try:
        # Check if demo data already exists
        count = await db.conversations.count_documents({})
        if count > 0:
            return {"message": "Demo data already exists", "count": count}
        
        # Create demo conversation
        conversation = {
            "customer_id": "demo-customer",
            "service_order_id": "demo-service-order",
            "title": "Demo Conversation",
            "status": "open",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "created_by": current_user["id"],
            "participants": [current_user["id"], "demo-customer"],
            "unread_count": 0
        }
        
        conversation_result = await db.conversations.insert_one(conversation)
        conversation_id = str(conversation_result.inserted_id)
        
        # Create demo messages
        messages = [
            {
                "content": "Hello, I need an update on my truck repair",
                "conversation_id": conversation_id,
                "sender_id": "demo-customer",
                "sender_type": "customer",
                "message_type": "text",
                "created_at": datetime.utcnow() 
            },
            {
                "content": "Hi there! We're working on your truck right now. The parts arrived this morning.",
                "conversation_id": conversation_id,
                "sender_id": current_user["id"],
                "sender_type": "user",
                "message_type": "text",
                "created_at": datetime.utcnow()
            },
            {
                "content": "When do you expect it to be ready?",
                "conversation_id": conversation_id,
                "sender_id": "demo-customer",
                "sender_type": "customer",
                "message_type": "text",
                "created_at": datetime.utcnow()
            }
        ]
        
        await db.messages.insert_many(messages)
        
        # Update conversation with last message
        await db.conversations.update_one(
            {"_id": conversation_result.inserted_id},
            {"$set": {"last_message": messages[-1]}}
        )
        
        return {
            "message": "Demo data created successfully",
            "conversation_id": conversation_id,
            "messages": len(messages)
        }
    except Exception as e:
        logger.error(f"Error creating demo data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create demo data: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)
