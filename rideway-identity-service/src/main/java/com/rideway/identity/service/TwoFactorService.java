package com.rideway.identity.service;

public interface TwoFactorService {

    String sendOtp(String mobileNumber);


    String verifyOtp(String mobileNumber, String otp);

    String formatIndianMobileNumber(String mobileNumber);
}
