# PostGIS Geospatial Query Patterns

> Compiled from official PostGIS docs, DeepWiki, Kina Technical, and community guides (2024-2026).

## Table of Contents

- [Setup and Installation](#setup-and-installation)
- [Geometry vs Geography](#geometry-vs-geography)
- [Core Spatial Functions](#core-spatial-functions)
- [Proximity Queries](#proximity-queries)
- [Polygon and Area Queries](#polygon-and-area-queries)
- [Spatial Joins](#spatial-joins)
- [Spatial Indexing](#spatial-indexing)
- [Performance Optimization](#performance-optimization)
- [Common Patterns](#common-patterns)

---

## Setup and Installation

```sql
-- Enable PostGIS extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Verify installation
SELECT PostGIS_Version();
-- Returns: 3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1

-- Check available spatial reference systems
SELECT srid, auth_name, auth_srid, proj4text
FROM spatial_ref_sys
WHERE auth_name = 'EPSG' AND auth_srid = 4326;
-- SRID 4326 = WGS 84 (GPS coordinates, lat/lng)
```

---

## Geometry vs Geography

Understanding the difference is **critical** for correct results:

| Type | Coordinate System | Speed | Distance Units | Best For |
|------|-------------------|-------|----------------|----------|
| **geometry** | Flat Cartesian plane | Fast | Degrees (lat/lng) | Small areas, projected CRS |
| **geography** | Sphere/spheroid | Slower | Meters | Global data, geodetic accuracy |

### When to Use Which

- **Use `geography`** for: lat/lng data spanning large distances, when you need meter-based distances, web applications with GPS coordinates
- **Use `geometry`** with projected CRS for: local computations needing speed, areas where Earth's curvature is negligible, when you need specific projection units

```sql
-- Geography table (recommended for most web apps)
CREATE TABLE restaurants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cuisine VARCHAR(100),
    rating DECIMAL(2,1),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    service_area GEOGRAPHY(POLYGON, 4326)
);

-- Insert with (longitude, latitude) order!
INSERT INTO restaurants (name, cuisine, rating, location)
VALUES (
    'Pizza Palace', 'Italian', 4.5,
    ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326)
);
```

> **Key Insight:** PostGIS uses `(longitude, latitude)` order, not `(lat, lng)`.

---

## Core Spatial Functions

### Relationship/Measurement Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `ST_Distance(a, b)` | Distance between two geometries | numeric |
| `ST_DWithin(a, b, dist)` | Is a within distance of b? | boolean |
| `ST_Contains(a, b)` | Does a contain b? | boolean |
| `ST_Within(a, b)` | Is a within b? | boolean |
| `ST_Intersects(a, b)` | Do they intersect? | boolean |
| `ST_Intersection(a, b)` | Geometric intersection | geometry |
| `ST_Buffer(geom, dist)` | Buffer around geometry | geometry |
| `ST_Area(geom)` | Area of geometry | numeric |
| `ST_Length(geom)` | Length/perimeter | numeric |
| `ST_Centroid(geom)` | Center point | geometry |
| `ST_Simplify(geom, tol)` | Reduce vertex count | geometry |

### Construction Functions

```sql
-- Create points
ST_SetSRID(ST_MakePoint(lon, lat), 4326)

-- Create from WKT
ST_GeogFromText('POINT(-73.9855 40.7580)')
ST_GeomFromText('POLYGON((-73.997 40.748, -73.970 40.748, -73.970 40.765, -73.997 40.765, -73.997 40.748))')

-- Create from GeoJSON
ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Point","coordinates":[-73.9857,40.7484]}'), 4326)
```

### Conversion Functions

```sql
-- Geography to/from geometry
my_geography::geometry
my_geometry::geography

-- Transform CRS
ST_Transform(geom, 3857)  -- Convert to Web Mercator (EPSG:3857)

-- To/from GeoJSON
ST_AsGeoJSON(geom)
ST_SetSRID(ST_GeomFromGeoJSON(json), 4326)

-- To/from WKT
ST_AsText(geom)
ST_GeomFromText('POINT(-73.9855 40.7580)')
```

---

## Proximity Queries

### Find Nearby Points (ST_DWithin)

```sql
-- Find all restaurants within 1.5 km of Times Square
SELECT
    name, cuisine, rating,
    ROUND(ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(-73.9855, 40.7580), 4326)::geography
    )::numeric) AS distance_meters
FROM restaurants
WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(-73.9855, 40.7580), 4326)::geography,
    1500  -- 1500 meters = 1.5 km
)
ORDER BY distance_meters;
```

### K-Nearest Neighbor (KNN)

```sql
-- Find 3 nearest restaurants using <-> operator (uses spatial index)
SELECT
    name, cuisine,
    ROUND(ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(-73.9855, 40.7580), 4326)::geography
    )::numeric) AS distance_meters
FROM restaurants
ORDER BY location <-> ST_SetSRID(ST_MakePoint(-73.9855, 40.7580), 4326)::geography
LIMIT 3;
```

### Distance with Additional Filters

```sql
-- Nearby restaurants, filtered by cuisine, sorted by distance
SELECT
    name, cuisine, rating,
    ROUND(ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint($lon, $lat), 4326)::geography
    )::numeric) AS distance_meters
FROM restaurants
WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint($lon, $lat), 4326)::geography,
    $radius_meters
)
AND cuisine = 'Italian'
AND rating >= 4.0
ORDER BY distance_meters
LIMIT 10;
```

---

## Polygon and Area Queries

### Containment Queries

```sql
-- Create delivery zones
CREATE TABLE delivery_zones (
    id SERIAL PRIMARY KEY,
    zone_name VARCHAR(100) NOT NULL,
    delivery_fee DECIMAL(5,2),
    boundary GEOGRAPHY(POLYGON, 4326) NOT NULL
);

INSERT INTO delivery_zones (zone_name, delivery_fee, boundary)
VALUES ('Midtown', 2.99, ST_GeogFromText(
    'POLYGON((-73.9970 40.7480, -73.9700 40.7480, -73.9700 40.7650, -73.9970 40.7650, -73.9970 40.7480))'
));

-- Find restaurants inside a delivery zone
SELECT r.name, r.cuisine, dz.zone_name, dz.delivery_fee
FROM restaurants r
JOIN delivery_zones dz ON ST_Within(r.location::geometry, dz.boundary::geometry);

-- Check if customer is in a delivery zone
SELECT zone_name, delivery_fee
FROM delivery_zones
WHERE ST_Within(
    ST_SetSRID(ST_MakePoint(-73.9850, 40.7550), 4326)::geometry,
    boundary::geometry
);
```

### Area Calculations

```sql
-- Area of each delivery zone in square kilometers
SELECT zone_name,
       ROUND((ST_Area(boundary) / 1000000)::numeric, 2) AS area_sq_km
FROM delivery_zones;
```

### Buffer Operations

```sql
-- Create 500m radius around each restaurant
SELECT name, ST_Buffer(location, 500) AS service_radius
FROM restaurants;

-- Find areas where two service radii overlap
SELECT a.name, b.name,
       ST_Area(ST_Intersection(
           ST_Buffer(a.location, 500)::geometry,
           ST_Buffer(b.location, 500)::geometry
       )) AS overlap_area
FROM restaurants a, restaurants b
WHERE a.id < b.id
  AND ST_Intersects(
      ST_Buffer(a.location, 500)::geometry,
      ST_Buffer(b.location, 500)::geometry
  );
```

---

## Spatial Joins

### Count Points per Polygon

```sql
-- Count restaurants per delivery zone
SELECT dz.zone_name, COUNT(r.id) AS restaurant_count
FROM delivery_zones dz
LEFT JOIN restaurants r ON ST_Within(r.location::geometry, dz.boundary::geometry)
GROUP BY dz.zone_name;
```

### Find Overlapping Polygons

```sql
-- Find delivery zones that overlap
SELECT
    a.zone_name AS zone_a,
    b.zone_name AS zone_b,
    ST_Area(ST_Intersection(a.boundary::geometry, b.boundary::geometry)) AS overlap_area
FROM delivery_zones a
JOIN delivery_zones b ON a.id < b.id
WHERE ST_Intersects(a.boundary::geometry, b.boundary::geometry);
```

### Nearest Neighbor with Attribute Join

```sql
-- For each customer, find nearest restaurant of their preferred cuisine
SELECT
    c.name AS customer_name,
    c.preferred_cuisine,
    r.name AS nearest_restaurant,
    ROUND(ST_Distance(c.location, r.location)::numeric) AS distance_m
FROM customers c
CROSS JOIN LATERAL (
    SELECT name, location
    FROM restaurants
    WHERE cuisine = c.preferred_cuisine
    ORDER BY c.location <-> restaurants.location
    LIMIT 1
) r;
```

### Point-in-Polygon with Aggregation

```sql
-- For each neighborhood, compute aggregate stats of contained restaurants
SELECT
    n.name AS neighborhood,
    COUNT(r.id) AS restaurant_count,
    ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
    ROUND(AVG(ST_Distance(r.location, n.centroid))::numeric, 0) AS avg_distance_to_center
FROM neighborhoods n
LEFT JOIN restaurants r ON ST_Within(r.location::geometry, n.boundary::geometry)
GROUP BY n.name, n.centroid;
```

---

## Spatial Indexing

### GiST Index (Default)

```sql
-- 2D GiST index (most common)
CREATE INDEX idx_restaurants_location
    ON restaurants USING GIST(location);

-- GiST for polygons
CREATE INDEX idx_zones_boundary
    ON delivery_zones USING GIST(boundary);
```

### SP-GiST Index (Better for Points)

```sql
-- SP-GiST for point data (non-overlapping partitioning)
CREATE INDEX idx_restaurants_spgist
    ON restaurants USING SPGIST(location);
```

### BRIN Index (Large Spatial Tables)

```sql
-- For large tables with natural spatial ordering (e.g., GPS traces)
CREATE INDEX idx_gps_tracks_location
    ON gps_tracks USING BRIN(location);
```

### Verify Index Usage

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT name FROM restaurants
WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(-73.9855, 40.7580), 4326)::geography,
    1000
);
```

---

## Performance Optimization

### 1. Bounding Box Pre-Filter

Always use the `&&` operator (bounding box overlaps) before expensive geometric operations:

```sql
-- BAD: expensive intersection on every row
SELECT * FROM parcels
WHERE ST_Intersects(geom, ST_GeomFromText('POLYGON(...)'));
-- GOOD: bounding box filter first, then exact check
SELECT * FROM parcels
WHERE geom && ST_GeomFromText('POLYGON(...)')
  AND ST_Intersects(geom, ST_GeomFromText('POLYGON(...)'));
```

### 2. Two-Step Filtering

Use cheaper operations before more expensive ones:

```sql
-- Step 1: Bounding box filter (fast, indexed)
-- Step 2: Exact geometry operation (slow, precise)
SELECT * FROM features
WHERE geom && $search_area           -- Fast bounding box check
  AND ST_Contains(geom, $point);     -- Exact containment check
```

### 3. Simplify Complex Geometries

```sql
-- Reduce vertex count for display/large queries
SELECT name, ST_Simplify(geom, 0.001) AS simplified  -- tolerance in CRS units
FROM boundaries;

-- Better quality simplification
SELECT name, ST_SimplifyPreserveTopology(geom, 0.001)
FROM boundaries;
```

### 4. Statistics Management

```sql
-- Update spatial statistics for planner accuracy
ANALYZE restaurants;

-- Set higher statistics target for spatial columns
ALTER TABLE restaurants ALTER COLUMN location SET STATISTICS 1000;
ANALYZE restaurants;
```

### 5. Limit Coordinate Transformations

```sql
-- BAD: transforming every row
SELECT ST_Transform(geom, 3857) FROM parcels;

-- GOOD: store in target SRID or transform infrequently
-- Better: use geography type for lat/lng data
```

### 6. Index-Only Scans

```sql
-- If you only need bounding box info, the index can serve the query
SELECT ST_XMin(geom), ST_XMax(geom), ST_YMin(geom), ST_YMax(geom)
FROM parcels
WHERE geom && $search_area;
```

---

## Common Patterns

### Ride-Sharing: Match to Nearest Drivers

```sql
-- Find nearest 5 available drivers to a rider
SELECT
    d.id, d.name, d.vehicle_type,
    ROUND(ST_Distance(
        d.current_location,
        ST_SetSRID(ST_MakePoint($rider_lon, $rider_lat), 4326)::geography
    )::numeric) AS distance_m
FROM drivers d
WHERE d.status = 'available'
  AND ST_DWithin(
      d.current_location,
      ST_SetSRID(ST_MakePoint($rider_lon, $rider_lat), 4326)::geography,
      5000  -- 5km max
  )
ORDER BY d.current_location <-> ST_SetSRID(ST_MakePoint($rider_lon, $rider_lat), 4326)::geography
LIMIT 5;
```

### Real Estate: Properties in School District

```sql
SELECT p.address, p.price, p.bedrooms, sd.district_name
FROM properties p
JOIN school_districts sd ON ST_Within(p.location::geometry, sd.boundary::geometry)
WHERE p.price BETWEEN 200000 AND 500000
ORDER BY p.price;
```

### Logistics: Route Optimization

```sql
-- Find all delivery stops within a route corridor
SELECT stop_id, address, ST_Distance(
    stop_location,
    ST_GeographyFromText('LINESTRING(-73.99 40.75, -73.97 40.77, -73.95 40.78)')
) AS distance_from_route
FROM delivery_stops
WHERE ST_DWithin(
    stop_location,
    ST_GeographyFromText('LINESTRING(-73.99 40.75, -73.97 40.77, -73.95 40.78)'),
    500  -- Within 500m of route
)
ORDER BY stop_order;
```

### Environmental: Area within Protected Zone

```sql
-- Calculate deforested area within each protected zone
SELECT
    pz.zone_name,
    ROUND((ST_Area(ST_Intersection(pz.boundary, df.deforested_area)) / 1000000)::numeric, 2)
        AS deforested_area_sq_km,
    ROUND((ST_Area(pz.boundary) / 1000000)::numeric, 2) AS total_area_sq_km
FROM protected_zones pz
JOIN deforestation_events df ON ST_Intersects(pz.boundary, df.deforested_area)
WHERE df.event_date >= '2024-01-01'
GROUP BY pz.zone_name, pz.boundary;
```

### GeoJSON Export

```sql
-- Export query results as GeoJSON for frontend mapping
SELECT jsonb_build_object(
    'type', 'FeatureCollection',
    'features', jsonb_agg(
        jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(r.location::geometry)::jsonb,
            'properties', jsonb_build_object(
                'name', r.name,
                'cuisine', r.cuisine,
                'rating', r.rating
            )
        )
    )
)
FROM restaurants r
WHERE ST_DWithin(
    r.location,
    ST_SetSRID(ST_MakePoint(-73.9855, 40.7580), 4326)::geography,
    2000
);
```

---

## Operator Reference

| Operator | Description | Indexed? | Use Case |
|----------|-------------|----------|----------|
| `&&` | Bounding box overlaps | Yes (GiST) | Fast first filter |
| `<@` | Contained by | Yes (GiST) | Point in polygon |
| `@>` | Contains | Yes (GiST) | Polygon contains point |
| `<->` | Distance (for ordering) | Yes (GiST) | KNN searches |
| `<#>` | Box distance | Yes (GiST) | Fast distance filtering |
| `<<` | Left of | Yes (GiST) | Directional queries |
| `>>` | Right of | Yes (GiST) | Directional queries |
| `<<|` | Below | Yes (GiST) | Directional queries |
| `\|>>` | Above | Yes (GiST) | Directional queries |
| `&&&` | ND overlaps | Yes (ND GiST) | 3D/4D overlap |

---

## Sources

- PostGIS Official Docs: https://postgis.net/docs/manual-dev/using_postgis_query.html
- DeepWiki PostGIS Performance Optimization: https://deepwiki.com/postgis/postgis/4.3-performance-optimization
- Kina Technical: Geospatial Data: PostGIS and Spatial Queries
- PostGIS Best Practices: https://sempervent.github.io/best-practices/postgres/postgis-best-practices/
- OSGeo Discourse: Best practices for optimizing spatial queries in PostGIS 3.5
