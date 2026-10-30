import React, { useState } from 'react';
import { ExportData, ExportLineItem, CommercialInvoiceFinal } from '../types';
import { numberToWords } from '../lib/documentGenerators';
import {
  PACKAGE_KIND_OPTIONS,
  formatNoAndKindOfPkg,
  inferPackageKind,
  buildItemMarksAndNos
} from '../lib/packageConstants';
import {
  generateCommercialInvoicePDF,
  generateCommercialInvoiceDOCX,
  downloadFileBlob
} from '../lib/exportGenerators';
import {
  FileText,
  AlertTriangle,
  Download,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  FileDown,
  FileCode
} from 'lucide-react';

interface Stage2PreShipmentProps {
  exportData: ExportData;
  onSaveExportData: (data: ExportData) => void;
  onProceedToStage3: () => void;
  onBackToStage1: () => void;
}

export const Stage2PreShipment: React.FC<Stage2PreShipmentProps> = ({
  exportData,
  onSaveExportData,
  onProceedToStage3,
  onBackToStage1
}) => {
  const [data, setData] = useState<ExportData>(exportData);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  React.useEffect(() => {
    if (exportData && exportData.lineItems) {
      const sanitized = exportData.lineItems.map(item => {
        const pkgKind = item.packageKind || item.cartonOption || inferPackageKind(item.noAndKindOfPkg || item.uom);
        const noOfCartons = item.noOfCartons != null ? Number(item.noOfCartons) : (parseInt(String(item.noAndKindOfPkg || '').replace(/,/g, ''), 10) || 0);
        const noAndKindOfPkg = item.noAndKindOfPkg && item.noAndKindOfPkg.trim()
          ? item.noAndKindOfPkg
          : formatNoAndKindOfPkg(noOfCartons, pkgKind);

        const qtyToMatch = Math.round(item.quantity || 0);
        const finalMarksAndNos = (!item.marksAndNos || (qtyToMatch > 0 && (item.marksAndNos.includes(`1 - ${qtyToMatch}`) || item.marksAndNos.includes(`1-${qtyToMatch}`))))
          ? buildItemMarksAndNos({
              ...item,
              noOfCartons,
              packageKind: pkgKind,
              cartonOption: pkgKind,
              quantity: item.quantity != null ? Number(item.quantity) : 0,
              grossWt: item.grossWt != null ? Number(item.grossWt) : 0,
              netWt: item.netWt != null ? Number(item.netWt) : 0,
              itemCount: item.itemCount || item.description || '',
              specification: item.specification,
              description: item.description,
              itemDescription1: item.itemDescription1 || item.description || ''
            })
          : item.marksAndNos;

        return {
          ...item,
          purchaseContractNo: item.purchaseContractNo || exportData.buyersOrderNo || '',
          itemCount: item.itemCount || item.description || '',
          quantity: item.quantity != null ? Number(item.quantity) : 0,
          grossWt: item.grossWt != null ? Number(item.grossWt) : 0,
          netWt: item.netWt != null ? Number(item.netWt) : 0,
          rate: item.rate != null ? Number(item.rate) : 0,
          ratePer: item.ratePer || '/',
          ratePer400: item.ratePer400 != null ? Number(item.ratePer400) : 0,
          unitOfRate: item.unitOfRate || item.uom || 'PCS',
          uom: item.uom || 'PCS',
          amount: item.amount != null ? Number(item.amount) : Math.round((Number(item.quantity) || 0) * (Number(item.rate) || 0) * 100) / 100,
          noOfCartons,
          packageKind: pkgKind,
          cartonOption: pkgKind,
          noAndKindOfPkg,
          itemDescription1: item.itemDescription1 || '',
          marksAndNos: finalMarksAndNos
        };
      });
      // Check if they are actually different to prevent infinite loops
      const hasDiff = JSON.stringify(sanitized) !== JSON.stringify(exportData.lineItems);
      if (hasDiff) {
        const totalAmount = sanitized.reduce((acc, it) => acc + (it.amount || 0), 0);
        const totalQuantity = sanitized.reduce((acc, it) => acc + (it.quantity || 0), 0);
        const totalGross = sanitized.reduce((acc, it) => acc + (it.grossWt || 0), 0);
        const totalNet = sanitized.reduce((acc, it) => acc + (it.netWt || 0), 0);
        const totalCartons = sanitized.reduce((acc, it) => acc + (it.noOfCartons || 0), 0);
        
        setData({
          ...exportData,
          lineItems: sanitized,
          totalAmount,
          totalQuantity,
          totalGrossWtKg: totalGross,
          totalNetWtKg: totalNet,
          totalCartons,
          amountInWords: numberToWords(totalAmount, exportData.currency || 'USD')
        });
      } else {
        setData(exportData);
      }
    } else {
      setData(exportData);
    }
  }, [exportData]);

  const updateData = (newData: ExportData) => {
    setData(newData);
    onSaveExportData(newData);
  };

  const handleFieldChange = (field: keyof ExportData, value: any) => {
    const updated = { ...data, [field]: value };
    updateData(updated);
  };

  const handleExporterChange = (field: string, value: any) => {
    const updated = {
      ...data,
      exporter: {
        ...data.exporter,
        [field]: value
      }
    };
    updateData(updated);
  };

  const handleLineItemChange = (index: number, field: keyof ExportLineItem | 'packageKind' | 'cartonOption', value: any) => {
    const updatedItems = [...data.lineItems];
    let typedValue = value;
    if (field === 'quantity' || field === 'grossWt' || field === 'netWt' || field === 'rate' || field === 'ratePer400' || field === 'noOfCartons') {
      typedValue = value === '' ? 0 : Number(value);
    }
    const item = { ...updatedItems[index], [field]: typedValue };

    // When packageKind or cartonOption is changed
    if (field === 'packageKind' || field === 'cartonOption') {
      item.packageKind = value;
      item.cartonOption = value;
      const count = item.noOfCartons != null && item.noOfCartons !== 0 ? item.noOfCartons : item.quantity;
      item.noAndKindOfPkg = formatNoAndKindOfPkg(count, value);
    }

    // When noOfCartons is changed, recompute noAndKindOfPkg with current packageKind
    if (field === 'noOfCartons') {
      const currentKind = item.packageKind || item.cartonOption || inferPackageKind(item.noAndKindOfPkg);
      item.noAndKindOfPkg = formatNoAndKindOfPkg(typedValue, currentKind);
    }

    // Calculate amount
    if (field === 'quantity' || field === 'rate') {
      const q = field === 'quantity' ? Number(typedValue) : item.quantity;
      const r = field === 'rate' ? Number(typedValue) : item.rate;
      item.amount = Math.round(q * r * 100) / 100;
    }

    // Automatically rebuild marksAndNos if critical package details or quantities change
    if (field === 'noOfCartons' || field === 'packageKind' || field === 'cartonOption' || field === 'grossWt' || field === 'netWt' || field === 'quantity' || field === 'itemDescription1' || field === 'itemCount') {
      item.marksAndNos = buildItemMarksAndNos(item);
    }

    updatedItems[index] = item;

    const newTotalAmount = updatedItems.reduce((acc, it) => acc + (it.amount || 0), 0);
    const newTotalQty = updatedItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
    const newTotalGross = updatedItems.reduce((acc, it) => acc + (Number(it.grossWt) || 0), 0);
    const newTotalNet = updatedItems.reduce((acc, it) => acc + (Number(it.netWt) || 0), 0);
    const newTotalCartons = updatedItems.reduce((acc, it) => acc + (Number(it.noOfCartons) || 0), 0);

    const updated = {
      ...data,
      lineItems: updatedItems,
      totalAmount: newTotalAmount,
      totalQuantity: newTotalQty,
      totalGrossWtKg: newTotalGross,
      totalNetWtKg: newTotalNet,
      totalCartons: newTotalCartons,
      amountInWords: numberToWords(newTotalAmount, data.currency || 'USD')
    };
    updateData(updated);
  };

  const handleAddLineItem = () => {
    const newItem: ExportLineItem = {
      marksAndNos: '',
      noAndKindOfPkg: '0 CARTONS',
      packageKind: 'CARTONS',
      cartonOption: 'CARTONS',
      description: '',
      purchaseContractNo: data.buyersOrderNo || '',
      itemCount: '',
      quantity: 0,
      grossWt: 0,
      netWt: 0,
      rate: 0,
      ratePer: '/',
      ratePer400: 0,
      unitOfRate: 'PCS',
      uom: 'PCS',
      amount: 0,
      noOfCartons: 0,
      itemDescription1: ''
    };
    const updatedItems = [...data.lineItems, newItem];
    const newTotalAmount = updatedItems.reduce((acc, it) => acc + (it.amount || 0), 0);
    const newTotalQty = updatedItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
    const newTotalGross = updatedItems.reduce((acc, it) => acc + (it.grossWt || 0), 0);
    const newTotalNet = updatedItems.reduce((acc, it) => acc + (it.netWt || 0), 0);
    const newTotalCartons = updatedItems.reduce((acc, it) => acc + (it.noOfCartons || 0), 0);

    const updated = {
      ...data,
      lineItems: updatedItems,
      totalAmount: newTotalAmount,
      totalQuantity: newTotalQty,
      totalGrossWtKg: newTotalGross,
      totalNetWtKg: newTotalNet,
      totalCartons: newTotalCartons,
      amountInWords: numberToWords(newTotalAmount, data.currency || 'USD')
    };
    updateData(updated);
  };

  const handleRemoveLineItem = (idx: number) => {
    if (data.lineItems.length <= 1) return;
    const updatedItems = data.lineItems.filter((_, i) => i !== idx);
    const newTotalAmount = updatedItems.reduce((acc, it) => acc + (it.amount || 0), 0);
    const newTotalQty = updatedItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
    const newTotalGross = updatedItems.reduce((acc, it) => acc + (Number(it.grossWt) || 0), 0);
    const newTotalNet = updatedItems.reduce((acc, it) => acc + (Number(it.netWt) || 0), 0);
    const newTotalCartons = updatedItems.reduce((acc, it) => acc + (Number(it.noOfCartons) || 0), 0);

    const updated = {
      ...data,
      lineItems: updatedItems,
      totalAmount: newTotalAmount,
      totalQuantity: newTotalQty,
      totalGrossWtKg: newTotalGross,
      totalNetWtKg: newTotalNet,
      totalCartons: newTotalCartons,
      amountInWords: numberToWords(newTotalAmount, data.currency || 'USD')
    };
    updateData(updated);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Main Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 bg-white text-blue-900 shadow-xs border border-slate-200">
              <FileText className="w-4 h-4 text-blue-600" />
              Commercial / Proforma Invoice Draft
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="export-draft-btn"
              onClick={() => setShowExportModal(true)}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Export Options
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6">
          {/* Header Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-slate-200 rounded-xl p-4 bg-slate-50/40">
            {/* Left Column: Exporter & Consignee */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Exporter / Shipper
                </label>
                <input
                  type="text"
                  value={data.exporter.name}
                  onChange={(e) => handleExporterChange('name', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-900 mb-1 focus:ring-1 focus:ring-blue-600"
                />
                <textarea
                  rows={2}
                  value={data.exporter.address}
                  onChange={(e) => handleExporterChange('address', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-700 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Consignee
                </label>
                <textarea
                  rows={3}
                  value={data.consignee}
                  onChange={(e) => handleFieldChange('consignee', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Buyer (If other than consignee)
                </label>
                <textarea
                  rows={2}
                  value={data.buyerIfOtherThanConsignee}
                  onChange={(e) => handleFieldChange('buyerIfOtherThanConsignee', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-700 focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Right Column: Invoice numbers, Order dates, Origins */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Invoice No.</label>
                  <input
                    type="text"
                    value={data.invoiceNo}
                    onChange={(e) => handleFieldChange('invoiceNo', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-bold text-blue-900 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Invoice Date</label>
                  <input
                    type="text"
                    value={data.invoiceDate}
                    onChange={(e) => handleFieldChange('invoiceDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-700 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">IRN No. (e-Invoice)</label>
                <input
                  type="text"
                  value={data.irnno || ''}
                  onChange={(e) => handleFieldChange('irnno', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Buyer's Order No.</label>
                  <input
                    type="text"
                    value={data.buyersOrderNo}
                    onChange={(e) => handleFieldChange('buyersOrderNo', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Order Date</label>
                  <input
                    type="text"
                    value={data.buyersOrderDate}
                    onChange={(e) => handleFieldChange('buyersOrderDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-700 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Country of Origin</label>
                  <input
                    type="text"
                    value={data.countryOfOrigin}
                    onChange={(e) => handleFieldChange('countryOfOrigin', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Country of Final Destination</label>
                  <input
                    type="text"
                    value={data.countryOfFinalDestination}
                    onChange={(e) => handleFieldChange('countryOfFinalDestination', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Other Reference / B/L No.</label>
                <input
                  type="text"
                  value={data.otherReference || ''}
                  onChange={(e) => handleFieldChange('otherReference', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Transport & Delivery Section */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 border border-slate-200 rounded-xl p-4 bg-slate-50/40 text-xs">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Pre-Carriage By</label>
              <input
                type="text"
                value={data.preCarriageBy || ''}
                onChange={(e) => handleFieldChange('preCarriageBy', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Place of Receipt</label>
              <input
                type="text"
                value={data.placeOfReceiptByPreCarrier || ''}
                onChange={(e) => handleFieldChange('placeOfReceiptByPreCarrier', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Vessel / Flight No.</label>
              <input
                type="text"
                value={data.vesselFlightNo || ''}
                onChange={(e) => handleFieldChange('vesselFlightNo', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Port of Loading</label>
              <input
                type="text"
                value={data.portOfLoading}
                onChange={(e) => handleFieldChange('portOfLoading', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Port of Discharge</label>
              <input
                type="text"
                value={data.portOfDischarge}
                onChange={(e) => handleFieldChange('portOfDischarge', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-slate-200 rounded-xl p-4 bg-slate-50/40 text-xs">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Final Destination</label>
              <input
                type="text"
                value={data.finalDestination || ''}
                onChange={(e) => handleFieldChange('finalDestination', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Terms of Delivery & Payment</label>
              <input
                type="text"
                value={data.termsOfDelivery || ''}
                onChange={(e) => handleFieldChange('termsOfDelivery', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-800"
              />
            </div>
          </div>

          {/* Invoice Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Commercial Line Items & Rates
              </h3>
              <button
                onClick={handleAddLineItem}
                className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-[#8b265d] font-bold border-b border-slate-300 text-[11px] uppercase">
                  <tr>
                    <th className="p-2 border-r border-slate-200 min-w-[140px]">Purchase Contract No</th>
                    <th className="p-2 border-r border-slate-200 min-w-[220px]">Item (Count)</th>
                    <th className="p-2 border-r border-slate-200 min-w-[110px] text-right">Quantity</th>
                    <th className="p-2 border-r border-slate-200 min-w-[100px] text-right">Gross Wt</th>
                    <th className="p-2 border-r border-slate-200 min-w-[100px] text-right">Net Wt</th>
                    <th className="p-2 border-r border-slate-200 min-w-[90px] text-right">Rate</th>
                    <th className="p-2 border-r border-slate-200 min-w-[70px] text-center">Rate Per</th>
                    <th className="p-2 border-r border-slate-200 min-w-[80px] text-right">Rate Per 400</th>
                    <th className="p-2 border-r border-slate-200 min-w-[90px] text-center">Unit of Rate</th>
                    <th className="p-2 border-r border-slate-200 min-w-[120px] text-right">Amount In USD</th>
                    <th className="p-2 border-r border-slate-200 min-w-[90px] text-right">No Of Cartons</th>
                    <th className="p-2 border-r border-slate-200 min-w-[170px]">Carton / Pkg Option</th>
                    <th className="p-2 border-r border-slate-200 min-w-[150px]">Item Description-1</th>
                    <th className="p-2 min-w-[40px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.lineItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      {/* Purchase Contract No */}
                      <td className="p-1 border-r border-slate-200 align-top">
                        <input
                          type="text"
                          value={item.purchaseContractNo || ''}
                          onChange={(e) => handleLineItemChange(idx, 'purchaseContractNo', e.target.value)}
                          className="w-full px-1.5 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] font-medium text-slate-800"
                        />
                      </td>

                      {/* Item (Count) */}
                      <td className="p-1 border-r border-slate-200 align-top">
                        <textarea
                          rows={2}
                          value={item.itemCount || ''}
                          onChange={(e) => handleLineItemChange(idx, 'itemCount', e.target.value)}
                          className="w-full px-1.5 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] font-mono text-slate-800 leading-snug"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="p-1 border-r border-slate-200 align-top">
                        <input
                          type="number"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-1.5 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] font-mono font-medium text-right"
                        />
                      </td>

                      {/* Gross Wt */}
                      <td className="p-1 border-r border-slate-200 align-top">
                        <input
                          type="number"
                          step="any"
                          value={item.grossWt || ''}
                          onChange={(e) => handleLineItemChange(idx, 'grossWt', e.target.value)}
                          className="w-full px-1.5 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] font-mono font-medium text-right"
                        />
                      </td>

                      {/* Net Wt */}
                      <td className="p-1 border-r border-slate-200 align-top">
                        <input
                          type="number"
                          step="any"
                          value={item.netWt || ''}
                          onChange={(e) => handleLineItemChange(idx, 'netWt', e.target.value)}
                          className="w-full px-1.5 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] font-mono font-medium text-right"
                        />
                      </td>

                      {/* Rate */}
                      <td className="p-1 border-r border-slate-200 align-top">
                        <input
                          type="number"
                          step="any"
                          value={item.rate}
                          onChange={(e) => handleLineItemChange(idx, 'rate', e.target.value)}
                          className="w-full px-1.5 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] font-mono font-medium text-right"
                        />
                      </td>

                      {/* Rate Per */}
                      <td className="p-1 border-r border-slate-200 align-top text-center">
                        <input
                          type="text"
                          value={item.ratePer || ''}
                          onChange={(e) => handleLineItemChange(idx, 'ratePer', e.target.value)}
                          className="w-full px-1 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] text-center font-bold"
                        />
                      </td>

                      {/* Rate Per 400 */}
                      <td className="p-1 border-r border-slate-200 align-top text-right">
                        <input
                          type="number"
                          value={item.ratePer400 != null ? item.ratePer400 : 0}
                          onChange={(e) => handleLineItemChange(idx, 'ratePer400', e.target.value)}
                          className="w-full px-1 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] text-right font-mono"
                        />
                      </td>

                      {/* Unit of Rate */}
                      <td className="p-1 border-r border-slate-200 align-top text-center">
                        <input
                          type="text"
                          value={item.unitOfRate || ''}
                          onChange={(e) => handleLineItemChange(idx, 'unitOfRate', e.target.value)}
                          className="w-full px-1 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] text-center font-bold uppercase text-slate-700"
                        />
                      </td>

                      {/* Amount In USD */}
                      <td className="p-1.5 border-r border-slate-200 align-top text-right font-bold text-slate-900 font-mono text-[11px]">
                        {(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* No Of Cartons */}
                      <td className="p-1 border-r border-slate-200 align-top">
                        <input
                          type="number"
                          value={item.noOfCartons || ''}
                          onChange={(e) => handleLineItemChange(idx, 'noOfCartons', e.target.value)}
                          className="w-full px-1.5 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] font-mono text-right"
                        />
                      </td>

                      {/* Carton / Pkg Option (Dropdown with ROLLS, CARTONS, BOXES options) */}
                      <td className="p-1 border-r border-slate-200 align-top">
                        <select
                          value={item.packageKind || item.cartonOption || inferPackageKind(item.noAndKindOfPkg)}
                          onChange={(e) => handleLineItemChange(idx, 'packageKind', e.target.value)}
                          className="w-full px-1.5 py-1 bg-amber-50/60 border border-amber-300 rounded text-[11px] font-semibold text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        >
                          {PACKAGE_KIND_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <div className="text-[9px] text-slate-500 mt-0.5 font-mono truncate px-0.5" title={item.noAndKindOfPkg || ''}>
                          No & Kind: <span className="font-semibold text-slate-700">{item.noAndKindOfPkg || formatNoAndKindOfPkg(item.noOfCartons || item.quantity, item.packageKind || 'CARTONS')}</span>
                        </div>
                      </td>

                      {/* Item Description-1 */}
                      <td className="p-1 border-r border-slate-200 align-top">
                        <input
                          type="text"
                          value={item.itemDescription1 || ''}
                          onChange={(e) => handleLineItemChange(idx, 'itemDescription1', e.target.value)}
                          className="w-full px-1.5 py-1 bg-slate-50/50 border border-slate-200 rounded text-[11px] text-slate-800"
                        />
                      </td>

                      {/* Delete Action */}
                      <td className="p-2 align-top text-center pt-2.5">
                        {data.lineItems.length > 1 && (
                          <button
                            onClick={() => handleRemoveLineItem(idx)}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-400 font-bold text-slate-900 text-xs">
                  <tr>
                    <td colSpan={2} className="p-2 text-right font-extrabold text-[#8b265d]">TOTALS:</td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold">
                      {(data.totalQuantity || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold">
                      {(data.totalGrossWtKg || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold">
                      {(data.totalNetWtKg || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                    </td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200"></td>
                    <td className="p-2 border-r border-slate-200 text-right text-emerald-950 font-extrabold font-mono text-sm">
                      {(data.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold">
                      {(data.totalCartons || 0).toLocaleString()}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-left font-mono font-bold text-[10px] text-slate-600">
                      {data.lineItems[0]?.packageKind || data.lineItems[0]?.cartonOption || 'CARTONS'}
                    </td>
                    <td colSpan={2} className="p-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Amount in words & Declaration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Amount in Words</label>
                <textarea
                  rows={2}
                  value={data.amountInWords}
                  onChange={(e) => handleFieldChange('amountInWords', e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded font-serif text-slate-800 text-xs"
                />
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Declaration Statement</label>
                <textarea
                  rows={2}
                  value={data.declarationText}
                  onChange={(e) => handleFieldChange('declarationText', e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded text-slate-700 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Navigation Bar */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              id="back-to-stage-1-btn"
              onClick={onBackToStage1}
              className="px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to LC
            </button>

            <button
              id="proceed-to-stage-3-btn"
              onClick={onProceedToStage3}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-colors"
            >
              Proceed to B/L Instruction (Stage 4)
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Export Draft Preview Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">Export Commercial Invoice Draft</h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Invoice: {data.invoiceNo}</span>
                <span>Order Ref: {data.buyersOrderNo}</span>
              </div>
              <div className="text-slate-600">
                <p>Buyer: {data.buyerIfOtherThanConsignee.split('\n')[0]}</p>
                <p>Total Value: {data.currency} {data.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p>Total Qty: {data.totalQuantity.toLocaleString()} {data.lineItems[0]?.uom || 'KGS'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  const invFinal: CommercialInvoiceFinal = {
                    isPreShipment: true,
                    exporter: data.exporter,
                    invoiceNo: data.invoiceNo,
                    invoiceDate: data.invoiceDate,
                    irnno: data.irnno,
                    otherReference: data.otherReference,
                    consignee: data.consignee,
                    buyerIfOtherThanConsignee: data.buyerIfOtherThanConsignee,
                    buyersOrderNo: data.buyersOrderNo,
                    buyersOrderDate: data.buyersOrderDate,
                    lcReference: data.lcReference || 'PRE-SHIPMENT DRAFT',
                    termsOfDelivery: data.termsOfDelivery || '',
                    countryOfOrigin: data.countryOfOrigin || 'INDIA',
                    countryOfFinalDestination: data.countryOfFinalDestination || 'BANGLADESH',
                    preCarriageBy: data.preCarriageBy,
                    placeOfReceipt: data.placeOfReceiptByPreCarrier,
                    vesselFlightNo: data.vesselFlightNo,
                    portOfLoading: data.portOfLoading,
                    portOfDischarge: data.portOfDischarge,
                    finalDestination: data.finalDestination,
                    currency: data.currency,
                    lineItems: data.lineItems,
                    totalQuantity: data.totalQuantity,
                    totalAmount: data.totalAmount,
                    amountInWords: data.amountInWords,
                    declarationText: data.declarationText,
                    rexNumber: data.rexNumber
                  };
                  const pdf = generateCommercialInvoicePDF(invFinal);
                  pdf.save(`Draft_Commercial_Invoice_${data.invoiceNo}.pdf`);
                  setShowExportModal(false);
                }}
                className="p-3 bg-red-50 hover:bg-red-100 text-red-900 border border-red-300 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <FileDown className="w-4 h-4 text-red-700" />
                Download Invoice PDF
              </button>
              <button
                onClick={async () => {
                  const invFinal: CommercialInvoiceFinal = {
                    isPreShipment: true,
                    exporter: data.exporter,
                    invoiceNo: data.invoiceNo,
                    invoiceDate: data.invoiceDate,
                    irnno: data.irnno,
                    otherReference: data.otherReference,
                    consignee: data.consignee,
                    buyerIfOtherThanConsignee: data.buyerIfOtherThanConsignee,
                    buyersOrderNo: data.buyersOrderNo,
                    buyersOrderDate: data.buyersOrderDate,
                    lcReference: data.lcReference || 'PRE-SHIPMENT DRAFT',
                    termsOfDelivery: data.termsOfDelivery || '',
                    countryOfOrigin: data.countryOfOrigin || 'INDIA',
                    countryOfFinalDestination: data.countryOfFinalDestination || 'BANGLADESH',
                    preCarriageBy: data.preCarriageBy,
                    placeOfReceipt: data.placeOfReceiptByPreCarrier,
                    vesselFlightNo: data.vesselFlightNo,
                    portOfLoading: data.portOfLoading,
                    portOfDischarge: data.portOfDischarge,
                    finalDestination: data.finalDestination,
                    currency: data.currency,
                    lineItems: data.lineItems,
                    totalQuantity: data.totalQuantity,
                    totalAmount: data.totalAmount,
                    amountInWords: data.amountInWords,
                    declarationText: data.declarationText,
                    rexNumber: data.rexNumber
                  };
                  const blob = await generateCommercialInvoiceDOCX(invFinal);
                  downloadFileBlob(blob, `Draft_Commercial_Invoice_${data.invoiceNo}.docx`);
                  setShowExportModal(false);
                }}
                className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <FileCode className="w-4 h-4 text-blue-700" />
                Download Invoice DOCX
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
