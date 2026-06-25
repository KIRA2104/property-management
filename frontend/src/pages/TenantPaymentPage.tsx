import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { CheckCircle, Lock, Building, Calendar, AlertCircle } from 'lucide-react';

const loadRazorpay = () => {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayErrorResponse {
  error: {
    description: string;
  };
}

declare global {
  interface Window {
    Razorpay: new (options: unknown) => {
      on: (event: string, handler: (response: RazorpayErrorResponse) => void) => void;
      open: () => void;
    };
  }
}

interface ChargeBreakdown {
  id: string;
  billing_month: string;
  amount: number;
  late_fee: number;
  total: number;
}

const TenantPaymentPage: React.FC = () => {
  const { agreementId } = useParams<{ agreementId: string }>();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: balanceData, isLoading, isError } = useQuery({
    queryKey: ['publicBalance', agreementId],
    queryFn: () => axios.get(`/public/agreements/${agreementId}/balance`).then(res => res.data),
    retry: false
  });

  const handlePayment = async () => {
    setIsProcessing(true);
    const res = await loadRazorpay();
    if (!res) {
      alert("Razorpay SDK failed to load. Are you online?");
      setIsProcessing(false);
      return;
    }
    
    try {
        const orderResp = await axios.post(`/public/agreements/${agreementId}/create-order`);
        const { order_id, amount, currency } = orderResp.data;
        
        const options = {
            key: balanceData.razorpay_key_id,
            amount: amount * 100, // Amount is in currency subunits.
            currency: currency,
            name: "Rent Payment",
            description: balanceData.property_name,
            order_id: order_id,
            handler: async function (response: RazorpaySuccessResponse) {
                try {
                    await axios.post(`/public/agreements/${agreementId}/verify`, {
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_signature: response.razorpay_signature,
                        amount: amount
                    });
                    setIsSuccess(true);
                } catch(err) {
                    console.error("Verification error:", err);
                    alert("Payment verification failed! Please contact the property manager.");
                } finally {
                    setIsProcessing(false);
                }
            },
            modal: {
                ondismiss: function() {
                    setIsProcessing(false);
                }
            },
            theme: {
                color: "#2563EB"
            }
        };
        
        const paymentObject = new window.Razorpay(options);
        paymentObject.on('payment.failed', function (response: RazorpayErrorResponse){
            alert("Payment failed: " + response.error.description);
            setIsProcessing(false);
        });
        paymentObject.open();
    } catch (err) {
        console.error("Payment initialization error:", err);
        alert("Failed to initiate payment. Please try again.");
        setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isError || !balanceData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Link Expired or Invalid</h2>
          <p className="text-gray-500 mb-6">We couldn't find any outstanding balance for this link. It may have expired or the rent is already paid.</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center transform transition-all animate-fade-in-up">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
          <p className="text-gray-500 mb-6">Your rent payment of ₹{balanceData.total_due.toLocaleString()} for {balanceData.property_name} has been processed via Razorpay.</p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">A receipt will be sent to your email.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-xl w-full">
        
        {/* Invoice Summary Side */}
        <div className="bg-white p-8 rounded-2xl shadow-xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Rent Payment Portal</h1>
            <p className="text-gray-500 mt-1">Review and securely pay your outstanding rent charges.</p>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <Building className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Property</p>
                <p className="text-lg font-medium text-gray-900">{balanceData.property_name}</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="bg-purple-50 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div className="w-full">
                <p className="text-sm text-gray-500">Pending Rent Charge</p>
                {balanceData.breakdown && balanceData.breakdown.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {balanceData.breakdown.map((charge: ChargeBreakdown) => (
                      <div key={charge.id} className="bg-gray-50 rounded p-3 flex justify-between items-center border border-gray-100">
                        <div>
                          <p className="font-semibold text-gray-900">{charge.billing_month}</p>
                          {charge.late_fee > 0 && <p className="text-xs text-red-500">Includes ₹{charge.late_fee.toLocaleString()} late fee</p>}
                        </div>
                        <p className="font-bold text-gray-900">₹{charge.total.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-lg font-medium text-gray-900">{balanceData.charges_count} item(s)</p>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-100">
            <div className="flex justify-between items-end mb-8">
              <p className="text-gray-500 font-medium">Total Amount Due</p>
              <p className="text-4xl font-bold text-gray-900">₹{balanceData.total_due.toLocaleString()}</p>
            </div>
            
            <button 
              onClick={handlePayment}
              disabled={isProcessing || balanceData.total_due <= 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Pay with Razorpay</span>
                </>
              )}
            </button>
            <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center space-x-1">
              <Lock className="w-3 h-3" />
              <span>Payments are securely processed by Razorpay</span>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TenantPaymentPage;
