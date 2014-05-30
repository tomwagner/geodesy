/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/*  Vector-based geodetic (latitude/longitude) functions              (c) Chris Veness 2011-2014  */
/*                                                                                                */
/*  These functions work with                                                                     */
/*   a) geodesic (polar) latitude/longitude points on the Earth's surface (in degrees)            */
/*   b) 3D vectors used as n-vectors representing points on the surface of the Earth's surface,   */
/*      or vectors normal to the plane of a great circle                                          */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
'use strict';


/**
 * Creates a LatLonV point on spherical model earth.
 *
 * @constructor
 * @classdesc Tools for geodetic calculations using ‘n-vectors’ (in place of spherical trigonometry)
 * @requires Vector3d
 * @requires Geo
 *
 * @param {number} lat - Latitude in degrees.
 * @param {number} lon - Longitude in degrees.
 * @param {number} [radius=6371] - Earth's mean radius in km.
 */
function LatLonV(lat, lon, radius) {
    if (typeof radius == 'undefined') radius = 6371;

    this.lat    = Number(lat);
    this.lon    = Number(lon);
    this.radius = Number(radius);
}


/**
 * Converts ‘this’ lat/lon point to Vector3d n-vector (normal to earth's surface).
 *
 * @returns {Vector3d} Normalised n-vector representing lat/lon point.
 */
LatLonV.prototype.toVector = function() {
    var φ = this.lat.toRadians();
    var λ = this.lon.toRadians();

    // right-handed vector: x -> 0°E,0°N; y -> 90°E,0°N, z -> 90°N
    var x = Math.cos(φ) * Math.cos(λ);
    var y = Math.cos(φ) * Math.sin(λ);
    var z = Math.sin(φ);

    return new Vector3d(x, y, z);
}


/**
 * Converts ‘this’ n-vector to latitude/longitude point.
 *
 * @augments Vector3d
 * @returns {LatLonV} Latitude/longitude point vector points to.
 */
Vector3d.prototype.toLatLon = function() {
    var φ = Math.atan2(this.z, Math.sqrt(this.x*this.x + this.y*this.y));
    var λ = Math.atan2(this.y, this.x);

    return new LatLonV(φ.toDegrees(), λ.toDegrees());
}


/**
 * Great circle obtained by heading on given bearing from ‘this’ point.
 *
 * @param   {number} bearing - Compass bearing in degrees.
 * @returns {Vector3d} Vector representing great circle.
 */
LatLonV.prototype.greatCircle = function(bearing) {
    var φ = this.lat.toRadians();
    var λ = this.lon.toRadians();
    var θ = Number(bearing).toRadians();

    var x =  Math.sin(λ) * Math.cos(θ) - Math.sin(φ) * Math.cos(λ) * Math.sin(θ);
    var y = -Math.cos(λ) * Math.cos(θ) - Math.sin(φ) * Math.sin(λ) * Math.sin(θ);
    var z =  Math.cos(φ) * Math.sin(θ);

    return new Vector3d(x, y, z);
}


/**
 * Returns the distance from ‘this’ point to the specified point.
 *
 * @param   {LatLonV} point - Latitude/longitude of destination point.
 * @returns {number} Distance between this point and destination point in km.
 */
LatLonV.prototype.distanceTo = function(point) {
    var p1 = this.toVector();
    var p2 = point.toVector();

    var δ = p1.angleTo(p2);
    var d = δ * this.radius;

    return d;
}


/**
 * Returns the (initial) bearing from ‘this’ point to the specified point, in compass degrees.
 *
 * @param   {LatLonV} point - Latitude/longitude of destination point.
 * @returns {number} Initial bearing in degrees from North (0°..360°).
 */
LatLonV.prototype.bearingTo = function(point) {
    var p1 = this.toVector();
    var p2 = point.toVector();

    var northPole = new Vector3d(0, 0, 1);

    var c1 = p1.cross(p2);        // great circle through p1 & p2
    var c2 = p1.cross(northPole); // great circle through p1 & north pole

    // bearing is (signed) angle between c1 & c2
    var sinθ = c1.cross(c2).length();
    var cosθ = c1.dot(c2);
    // use p1 as reference to get sign of sinθ
    sinθ = c1.cross(c2).dot(p1)<0 ? -sinθ : sinθ;

    var bearing = Math.atan2(sinθ, cosθ).toDegrees();

    return (bearing+360) % 360; // normalise to 0..360
}


/**
 * Returns the midpoint between ‘this’ point and specified point.
 *
 * @param   {LatLonV} point - Latitude/longitude of destination point.
 * @returns {LatLonV} Midpoint between this point and destination point.
 */
LatLonV.prototype.midpointTo = function(point) {
    var p1 = this.toVector();
    var p2 = point.toVector();

    var mid = p1.plus(p2).unit();

    return mid.toLatLon();
}


/**
 * Returns the destination point from ‘this’ point having travelled the given distance on the
 * given initial bearing (bearing will normally vary before destination is reached).
 *
 * @param   {number}  bearing - Initial bearing in degrees.
 * @param   {number}  distance - Distance in km.
 * @returns {LatLonV} Destination point.
 */
LatLonV.prototype.destinationPoint = function(bearing, distance) {
    var δ = Number(distance) / this.radius; // angular distance in radians

    // get great circle obtained by starting from 'this' point on given bearing
    var c = this.greatCircle(bearing);

    var p1 = this.toVector();

    var x = p1.times(Math.cos(δ));          // component of p2 parallel to p1
    var y = c.cross(p1).times(Math.sin(δ)); // component of p2 perpendicular to p1

    var p2 = x.plus(y).unit();

    return p2.toLatLon();
}


/**
 * Returns the point of intersection of two paths each defined by point pairs or start point and bearing.
 *
 * @param   {LatLonV}        path1start - Start point of first path.
 * @param   {LatLonV|number} path1brngEnd - End point of first path or initial bearing from first start point.
 * @param   {LatLonV}        path2start - Start point of second path.
 * @param   {LatLonV|number} path2brngEnd - End point of second path or initial bearing from second start point.
 * @returns {LatLonV} Destination point (null if no unique intersection defined)
 */
LatLonV.intersection = function(path1start, path1brngEnd, path2start, path2brngEnd) {
    if (typeof path1brngEnd == 'LatLonV') {       // path 1 defined by endpoint
        var c1 = path1start.cross(path1brngEnd);
    } else {                                     // path 1 defined by initial bearing
        var c1 = path1start.greatCircle(path1brngEnd);
    }
    if (typeof path2brngEnd == 'LatLonV') {       // path 2 defined by endpoint
        var c2 = path2start.cross(path2brngEnd);
    } else {                                     // path 2 defined by initial bearing
        var c2 = path2start.greatCircle(path2brngEnd);
    }

    var intersection = c1.cross(c2);

    return intersection.toLatLon();
}


/**
 * Returns (signed) distance from ‘this’ point to great circle defined by start-point and end-point/bearing.
 *
 * @param   {LatLonV}        pathstart - Start point of great circle path.
 * @param   {LatLonV|number} pathbrngEnd - End point of great circle path or initial bearing from great circle start point.
 * @returns {number} Distance to great circle.
 */
LatLonV.prototype.crossTrackDistanceTo = function(pathStart, pathBrngEnd) {
    var p = this.toVector();

    if (typeof pathbrngEnd == 'LatLonV') {
        var pathEnd = pathbrngEnd;
        var gc = pathStart.cross(pathEnd);
    } else {
        var pathBrng = Number(pathBrngEnd);
        var gc = pathStart.greatCircle(pathBrng);
    }

    var α = Math.PI/2 - p.angleTo(gc);
    var d = α * this.radius;

    return d;
}


/**
 * Tests whether ‘this’ point is enclosed by the (convex) polygon defined by a set of points.
 *
 * @param   {LatLonV[]} points - Ordered array of points defining vertices of polygon.
 * @returns {bool} Whether this point is enclosed by region.
 * @todo Not yet tested.
 */
LatLonV.prototype.enclosedBy = function(points) {
    // if fully closed polygon, pop last point off array
    if (points[0].equals(points[points.length-1])) points.pop();

    // get sign of cross-track distance for ultimate segment
    var p1 = points[points.length-1];
    var p2 = points[0];
    var side = Math.sign(this.crossTrackDistanceTo(p2, p2));

    var turn = Math.sign(p1.cross.p2); // to check polygon is convex

    // for 'this' to be enclosed, sign of all cross-track distances must be the same
    for (var p=1; p<points.length; p++) {
        p1 = p - 1;
        p2 = p;
        if (Math.sign(this.crossTrackDistanceTo(p2, p2)) != side) return false;
        if (Math.sign(p1.cross.p2) != turn) throw new Error('Polygon must be convex');
    }

    return true;
}


/**
 * Returns point representing geographic mean of supplied points.
 *
 * @param   {LatLonV[]} points - Array of points to be averaged.
 * @returns {LatLonV} Point at the geographic mean of the supplied points.
 * @todo Not yet tested.
 */
LatLonV.meanOf = function(points) {
    var m = new LatLonV(0, 0, 0);

    for (var p=0; p<points.length; p++) {
        m = m.plus(points[p]);
    }

    return m.unit();
}


/**
 * Checks if another point is equal to ‘this’ point.
 *
 * @param   {LatLonV} point - Point to be compared against this point.
 * @returns {bool} True if points are identical.
 */
LatLonV.prototype.equals = function(point) {
    if (this.lat==points.lat && this.lon==point.lon && this.radius==point.radius) return true;
    return false;
}


/**
 * Returns a string representation of ‘this’ point.
 *
 * @param   {string} [format=dms] - Format point as 'd', 'dm', 'dms'.
 * @param   {number} [dp=0|2|4] - Number of decimal places to use - default 0 for dms, 2 for dm, 4 for d.
 * @returns {string} Comma-separated formatted latitude/longitude.
 */
LatLonV.prototype.toString = function(format, dp) {
    if (typeof format == 'undefined') format = 'dms';

    return Geo.toLat(this.lat, format, dp) + ', ' + Geo.toLon(this.lon, format, dp);
}


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

/** Extend Number object with method to convert numeric degrees to radians */
if (typeof Number.prototype.toRadians == 'undefined') {
  Number.prototype.toRadians = function() { return this * Math.PI / 180; }
}

/** Extend Number object with method to convert radians to numeric (signed) degrees */
if (typeof Number.prototype.toDegrees == 'undefined') {
  Number.prototype.toDegrees = function() { return this * 180 / Math.PI; }
}

/** Extend Math object to test the sign of a number, indicating whether it's positive, negative or zero */
if (typeof Math.sign == 'undefined') {
    // stackoverflow.com/questions/7624920/number-sign-in-javascript
    Math.sign = function(x) {
        return typeof x === 'number' ? x ? x < 0 ? -1 : 1 : x === x ? 0 : NaN : NaN;
    }
}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
if (!window.console) window.console = { log: function() {} };
