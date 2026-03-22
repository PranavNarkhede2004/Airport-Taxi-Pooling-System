import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Search, MapPin } from 'lucide-react';

// Fix leaflet default icon issue in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: icon,
  shadowUrl: iconShadow,
});

const MapPicker = ({ defaultPos, initialAddress, onAddressSelect }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerInstance = useRef(null);

  const [address, setAddress] = useState(initialAddress || '');
  const [isLocating, setIsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // defaultPos from parent is [lng, lat], so Leaflet needs [lat, lng]
  const initialLat = defaultPos ? defaultPos[1] : 19.0760;
  const initialLng = defaultPos ? defaultPos[0] : 72.8777;

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize Map only once
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([initialLat, initialLng], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(mapInstance.current);

      markerInstance.current = L.marker([initialLat, initialLng], { draggable: true }).addTo(mapInstance.current);

      // Handle Map Click
      mapInstance.current.on('click', (e) => {
        const { lat, lng } = e.latlng;
        markerInstance.current.setLatLng([lat, lng]);
        mapInstance.current.flyTo([lat, lng]);
        reverseGeocode(lat, lng);
      });

      // Handle Marker Drag
      markerInstance.current.on('dragend', () => {
        const { lat, lng } = markerInstance.current.getLatLng();
        mapInstance.current.flyTo([lat, lng]);
        reverseGeocode(lat, lng);
      });
    }

    // Cleanup on unmount
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search for the address
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true);
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&countrycodes=in`) // Default to India for better results
          .then(res => res.json())
          .then(data => {
            setSearchResults(data || []);
            setIsSearching(false);
          })
          .catch(err => {
            console.error("Search failed", err);
            setIsSearching(false);
          });
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const reverseGeocode = (lat, lng) => {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.display_name) {
          setAddress(data.display_name);
          // Pass back as [lng, lat]
          onAddressSelect([lng, lat], data.display_name);
        }
      })
      .catch(err => console.error("Geocoding failed", err));
  };

  const handleSelectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const displayName = result.display_name;

    if (mapInstance.current && markerInstance.current) {
      markerInstance.current.setLatLng([lat, lng]);
      mapInstance.current.flyTo([lat, lng], 15);
    }
    
    setAddress(displayName);
    setSearchQuery('');
    setSearchResults([]);
    onAddressSelect([lng, lat], displayName);
  };

  const getCurrentLocation = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapInstance.current && markerInstance.current) {
          markerInstance.current.setLatLng([latitude, longitude]);
          mapInstance.current.flyTo([latitude, longitude], 15);
        }
        reverseGeocode(latitude, longitude);
        setIsLocating(false);
      }, () => {
        setIsLocating(false);
      });
    } else {
      setIsLocating(false);
    }
  };

  return (
    <div className="flex flex-col space-y-3 relative">
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-600 font-medium">Click map or drag the pin to set pickup</span>
        <button 
          type="button" 
          onClick={getCurrentLocation}
          className="text-blue-600 hover:text-blue-700 flex items-center font-medium"
        >
          <Navigation className={`w-4 h-4 mr-1 ${isLocating ? 'animate-pulse' : ''}`} />
          Use Current Location
        </button>
      </div>

      {/* Location Search Bar */}
      <div className="relative z-10 text-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border border-blue-200 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
            placeholder="Search for an address or landmark..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isSearching && (
            <div className="absolute right-3 top-3 w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
          )}
        </div>
        
        {/* Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto z-[1000]">
            {searchResults.map((result, idx) => (
              <button
                key={result.place_id || idx}
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-start transition-colors"
                onClick={() => handleSelectSearchResult(result)}
              >
                <MapPin className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-sm line-clamp-2 text-gray-700">{result.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      
      <div 
        ref={mapRef} 
        className="h-[300px] z-0 relative w-full rounded-xl overflow-hidden shadow-md border border-gray-300"
      ></div>
      
      {address && (
        <div className="text-sm bg-blue-50 text-blue-900 p-3 rounded-lg border border-blue-100 flex items-start shadow-inner">
          <span className="font-semibold mr-2 min-w-[max-content]">Selected:</span> 
          <span className="line-clamp-2 font-medium">{address}</span>
        </div>
      )}
    </div>
  );
};

export default MapPicker;
