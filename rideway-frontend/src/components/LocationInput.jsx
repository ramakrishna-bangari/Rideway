import React, { useState, useEffect, useRef } from 'react';
import { searchLocations, getCurrentGpsPosition } from '../utils/geocoding';
import { MapPin, Navigation, Loader2, X, Check } from 'lucide-react';

export const LocationInput = ({
  label = 'Location',
  placeholder = 'Search address or landmark...',
  value = '',
  onChangeAddress,
  onSelectLocation,
  showGpsButton = false,
  isPickup = false,
  className = '',
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const newText = e.target.value;
    setQuery(newText);
    onChangeAddress?.(newText);
    setActiveIndex(-1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!newText || !newText.trim()) {
      onSelectLocation?.(null);
      setSuggestions([]);
      setIsDropdownOpen(false);
      setIsLoading(false);
      return;
    }

    if (newText.trim().length < 2) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(newText);
        setSuggestions(results);
        setIsDropdownOpen(results.length > 0);
      } catch (err) {
        console.warn('Geocoding search failed:', err);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 350);
  };

  const handleSelectSuggestion = (item) => {
    const text = item.fullAddress || item.name;
    setQuery(text);
    onChangeAddress?.(text);
    onSelectLocation?.({
      address: text,
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
    });
    setSuggestions([]);
    setIsDropdownOpen(false);
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        handleSelectSuggestion(suggestions[activeIndex]);
      } else if (suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
      } else if (query && query.trim().length >= 2) {
        setIsLoading(true);
        try {
          const results = await searchLocations(query.trim());
          if (results && results.length > 0) {
            handleSelectSuggestion(results[0]);
          }
        } finally {
          setIsLoading(false);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const handleBlur = () => {

    setTimeout(() => {
      if (query && query.trim().length >= 2 && suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
      }
    }, 200);
  };

  const handleUseGps = async () => {
    setGpsLoading(true);
    try {
      const position = await getCurrentGpsPosition();
      setQuery(position.address);
      onChangeAddress?.(position.address);
      onSelectLocation?.({
        address: position.address,
        latitude: Number(position.latitude),
        longitude: Number(position.longitude),
      });
      setIsDropdownOpen(false);
    } catch (err) {
      alert(err.message || 'Could not retrieve your current location');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    onChangeAddress?.('');
    onSelectLocation?.(null);
    setSuggestions([]);
    setIsDropdownOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
          <span className={`w-2.5 h-2.5 rounded-full ${isPickup ? 'bg-emerald-500' : 'bg-black'}`} />
          {label}
        </label>
        {showGpsButton && (
          <button
            type="button"
            onClick={handleUseGps}
            disabled={gpsLoading}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition disabled:opacity-50"
          >
            {gpsLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Navigation className="w-3.5 h-3.5" />
            )}
            <span>Current GPS</span>
          </button>
        )}
      </div>

      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
          <MapPin className={`w-4 h-4 ${isPickup ? 'text-emerald-500' : 'text-gray-900'}`} />
        </div>

        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsDropdownOpen(true);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-9 py-3 rounded-xl border border-gray-300 bg-white text-xs font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black transition shadow-sm"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
          {query && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:text-gray-800 transition rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isDropdownOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-gray-100">
          {suggestions.map((item, idx) => (
            <button
              key={item.id || idx}
              type="button"
              onClick={() => handleSelectSuggestion(item)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`w-full p-3 text-left flex items-start gap-3 transition ${activeIndex === idx ? 'bg-gray-100 text-black' : 'hover:bg-gray-50 text-gray-800'
                }`}
            >
              <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{item.fullAddress}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationInput;
