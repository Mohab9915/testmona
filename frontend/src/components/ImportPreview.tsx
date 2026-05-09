import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CustomFieldDefinition, TestCase } from '@/types';
import { 
  Check, 
  X, 
  AlertTriangle, 
  Download, 
  Upload, 
  Eye, 
  EyeOff,
  RotateCcw,
  Save,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Folder
} from 'lucide-react';

interface ImportPreviewProps {
  file: File;
  testSuiteId: number;
  sectionId?: number;
  customFields: CustomFieldDefinition[];
  onConfirm: (validatedData: any[]) => Promise<void>;
  onCancel: () => void;
  sections?: Array<{ id: string; name: string; parentId?: string }>;
}

interface ParsedRow {
  id: string;
  data: Record<string, any>;
  errors: string[];
  warnings: string[];
  isValid: boolean;
  isEdited: boolean;
}

interface ColumnMapping {
  csvColumn: string;
  targetField: string;
  customFieldId?: number;
  confidence?: number;
}

const DEFAULT_TEST_CASE_FIELDS = [
  { key: 'title', label: 'Title', required: true, type: 'text' },
  { key: 'description', label: 'Description', required: false, type: 'textarea' },
  { key: 'preconditions', label: 'Preconditions', required: false, type: 'textarea' },
  { key: 'steps', label: 'Test Steps', required: false, type: 'textarea' },
  { key: 'expected_result', label: 'Expected Result', required: false, type: 'textarea' },
  { key: 'test_type', label: 'Test Type', required: false, type: 'select', options: ['manual', 'automated', 'smoke', 'regression', 'integration', 'security', 'performance', 'usability'] },
  { key: 'priority', label: 'Priority', required: false, type: 'select', options: ['low', 'medium', 'high', 'critical'] },
];

const FIELD_COLORS = {
  text: 'bg-blue-50 border-blue-200 focus:border-blue-400',
  textarea: 'bg-green-50 border-green-200 focus:border-green-400',
  select: 'bg-purple-50 border-purple-200 focus:border-purple-400',
  number: 'bg-orange-50 border-orange-200 focus:border-orange-400',
  date: 'bg-pink-50 border-pink-200 focus:border-pink-400',
  boolean: 'bg-yellow-50 border-yellow-200 focus:border-yellow-400',
};

export function ImportPreview({ file, testSuiteId, sectionId, customFields, onConfirm, onCancel, sections = [] }: ImportPreviewProps) {
  const { toast } = useToast();
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [showInvalidRows, setShowInvalidRows] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [mappingStep, setMappingStep] = useState(true);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sectionId?.toString() || 'none');

  // Parse CSV file
  const parseCSV = useCallback((text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });

    return { headers, rows };
  }, []);

  // Initialize parsing
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      
      setAvailableColumns(headers);
      
      // Smart auto-mapping with enhanced pattern recognition
      const autoMapping: ColumnMapping[] = headers.map(col => {
        const lowerCol = col.toLowerCase().trim();
        let targetField = '';
        let confidence = 0;
        
        // Enhanced title matching
        if (lowerCol.includes('title') || lowerCol.includes('name') || lowerCol.includes('test case') || lowerCol.includes('testcase')) {
          targetField = 'title';
          confidence = lowerCol.includes('title') ? 100 : 80;
        }
        // Enhanced description matching
        else if (lowerCol.includes('description') || lowerCol.includes('desc') || lowerCol.includes('details') || lowerCol.includes('summary')) {
          targetField = 'description';
          confidence = lowerCol.includes('description') ? 100 : 70;
        }
        // Enhanced preconditions matching
        else if (lowerCol.includes('precondition') || lowerCol.includes('pre-cond') || lowerCol.includes('setup') || lowerCol.includes('prerequisite')) {
          targetField = 'preconditions';
          confidence = lowerCol.includes('precondition') ? 100 : 75;
        }
        // Enhanced steps matching
        else if (lowerCol.includes('step') || lowerCol.includes('procedure') || lowerCol.includes('action') || lowerCol.includes('test step')) {
          targetField = 'steps';
          confidence = lowerCol.includes('test step') ? 100 : (lowerCol.includes('step') ? 90 : 60);
        }
        // Enhanced expected result matching
        else if (lowerCol.includes('expected') || lowerCol.includes('result') || lowerCol.includes('outcome') || lowerCol.includes('expected result')) {
          targetField = 'expected_result';
          confidence = lowerCol.includes('expected result') ? 100 : 80;
        }
        // Enhanced test type matching
        else if (lowerCol.includes('type') || lowerCol.includes('test type') || lowerCol.includes('category') || lowerCol.includes('test_type')) {
          targetField = 'test_type';
          confidence = lowerCol.includes('test type') ? 100 : (lowerCol.includes('type') ? 70 : 50);
        }
        // Enhanced priority matching
        else if (lowerCol.includes('priority') || lowerCol.includes('prio') || lowerCol.includes('level') || lowerCol.includes('urgency')) {
          targetField = 'priority';
          confidence = lowerCol.includes('priority') ? 100 : 75;
        }
        
        // Check custom fields with fuzzy matching
        const customField = customFields.find(cf => {
          const fieldName = cf.name.toLowerCase();
          const fieldSlug = cf.slug?.toLowerCase() || '';
          
          // Exact match
          if (fieldName === lowerCol || fieldSlug === lowerCol) {
            confidence = 100;
            return true;
          }
          
          // Contains match
          if (fieldName.includes(lowerCol) || lowerCol.includes(fieldName) || 
              fieldSlug.includes(lowerCol) || lowerCol.includes(fieldSlug)) {
            confidence = Math.max(confidence, 85);
            return true;
          }
          
          // Word boundary matching
          const fieldWords = fieldName.split(/\s+/);
          const colWords = lowerCol.split(/\s+/);
          
          for (const fieldWord of fieldWords) {
            for (const colWord of colWords) {
              if (fieldWord === colWord && fieldWord.length > 2) {
                confidence = Math.max(confidence, 70);
                return true;
              }
            }
          }
          
          return false;
        });
        
        if (customField) {
          return { csvColumn: col, targetField: 'custom_field', customFieldId: customField.id };
        }
        
        // Return mapping with confidence (for potential future use)
        return { csvColumn: col, targetField, confidence };
      });
      
      setColumnMapping(autoMapping);
      
      // Parse rows with initial validation
      const parsed: ParsedRow[] = rows.map((row, index) => ({
        id: `row-${index}`,
        data: row,
        errors: [],
        warnings: [],
        isValid: true,
        isEdited: false,
      }));
      
      setParsedData(parsed);
    };
    reader.readAsText(file);
  }, [file, parseCSV, customFields]);

  // Validate mapped data
  const validateMappedData = useCallback(() => {
    const updated = parsedData.map(row => {
      const errors: string[] = [];
      const warnings: string[] = [];
      let isValid = true;

      columnMapping.forEach(mapping => {
        if (!mapping.targetField) return;

        const value = row.data[mapping.csvColumn];

        if (mapping.targetField === 'title' && !value?.trim()) {
          errors.push('Title is required');
          isValid = false;
        }

        if (mapping.targetField === 'priority' && value) {
          const validPriorities = ['low', 'medium', 'high', 'critical'];
          if (!validPriorities.includes(value.toLowerCase())) {
            warnings.push(`Invalid priority: ${value}`);
          }
        }

        if (mapping.targetField === 'test_type' && value) {
          const validTypes = ['manual', 'automated', 'smoke', 'regression', 'integration', 'security', 'performance', 'usability'];
          if (!validTypes.includes(value.toLowerCase())) {
            warnings.push(`Invalid test type: ${value}`);
          }
        }

        // Custom field validation
        if (mapping.targetField === 'custom_field' && mapping.customFieldId) {
          const customField = customFields.find(cf => cf.id === mapping.customFieldId);
          if (customField) {
            if (customField.is_required && !value?.trim()) {
              errors.push(`${customField.name} is required`);
              isValid = false;
            }
            
            if (customField.field_type === 'number' && value && isNaN(Number(value))) {
              errors.push(`${customField.name} must be a number`);
              isValid = false;
            }
            
            if (customField.field_type === 'select' && value) {
              const options = customField.options as string[] || [];
              if (!options.includes(value)) {
                warnings.push(`Invalid option for ${customField.name}: ${value}`);
              }
            }
          }
        }
      });

      return { ...row, errors, warnings, isValid };
    });

    setParsedData(updated);
  }, [columnMapping, customFields]);

  // Validate when mapping changes
  useEffect(() => {
    if (columnMapping.length > 0) {
      validateMappedData();
    }
  }, [columnMapping, validateMappedData]);

  // Update column mapping
  const updateMapping = (csvColumn: string, targetField: string, customFieldId?: number) => {
    setColumnMapping(prev => 
      prev.map(mapping => 
        mapping.csvColumn === csvColumn 
          ? { ...mapping, targetField, customFieldId }
          : mapping
      )
    );
  };

  // Update cell value
  const updateCellValue = (rowId: string, csvColumn: string, value: string) => {
    setParsedData(prev => 
      prev.map(row => 
        row.id === rowId 
          ? { 
              ...row, 
              data: { ...row.data, [csvColumn]: value },
              isEdited: true 
            }
          : row
      )
    );
  };

  // Get field type for styling
  const getFieldType = (csvColumn: string) => {
    const mapping = columnMapping.find(m => m.csvColumn === csvColumn);
    if (!mapping?.targetField) return 'text';
    
    if (mapping.targetField === 'custom_field' && mapping.customFieldId) {
      const customField = customFields.find(cf => cf.id === mapping.customFieldId);
      return customField?.field_type || 'text';
    }
    
    const field = DEFAULT_TEST_CASE_FIELDS.find(f => f.key === mapping.targetField);
    return field?.type || 'text';
  };

  // Render editable cell
  const renderEditableCell = (row: ParsedRow, csvColumn: string) => {
    const fieldType = getFieldType(csvColumn);
    const value = row.data[csvColumn] || '';
    const mapping = columnMapping.find(m => m.csvColumn === csvColumn);
    
    const baseClasses = `w-full px-2 py-1 border rounded text-sm transition-all ${
      FIELD_COLORS[fieldType as keyof typeof FIELD_COLORS] || 'bg-gray-50 border-gray-200'
    } ${row.isEdited ? 'ring-2 ring-blue-400' : ''}`;

    if (!mapping?.targetField) {
      return (
        <div className="text-gray-400 text-xs italic px-2 py-1">
          Not mapped
        </div>
      );
    }

    if (fieldType === 'select') {
      let options: string[] = [];
      
      if (mapping.targetField === 'custom_field' && mapping.customFieldId) {
        const customField = customFields.find(cf => cf.id === mapping.customFieldId);
        options = (customField?.options as string[]) || [];
      } else {
        const field = DEFAULT_TEST_CASE_FIELDS.find(f => f.key === mapping.targetField);
        options = field?.options || [];
      }

      return (
        <Select
          value={value}
          onValueChange={(newValue) => updateCellValue(row.id, csvColumn, newValue)}
        >
          <SelectTrigger className={baseClasses}>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (fieldType === 'textarea') {
      return (
        <Textarea
          value={value}
          onChange={(e) => updateCellValue(row.id, csvColumn, e.target.value)}
          className={baseClasses}
          rows={2}
        />
      );
    }

    if (fieldType === 'boolean') {
      return (
        <div className="flex items-center space-x-2 px-2 py-1">
          <Checkbox
            checked={value.toLowerCase() === 'true' || value === '1'}
            onCheckedChange={(checked) => updateCellValue(row.id, csvColumn, checked ? 'true' : 'false')}
          />
          <span className="text-sm">{value ? 'Yes' : 'No'}</span>
        </div>
      );
    }

    return (
      <Input
        type={fieldType}
        value={value}
        onChange={(e) => updateCellValue(row.id, csvColumn, e.target.value)}
        className={baseClasses}
      />
    );
  };

  // Prepare data for import
  const prepareImportData = () => {
    return parsedData
      .filter(row => row.isValid)
      .map(row => {
        const testCase: any = {
          test_suite_id: testSuiteId,
          section_id: selectedSectionId && selectedSectionId !== 'none' ? parseInt(selectedSectionId) : undefined,
        };

        columnMapping.forEach(mapping => {
          if (!mapping.targetField) return;

          const value = row.data[mapping.csvColumn];

          if (mapping.targetField === 'custom_field' && mapping.customFieldId) {
            if (!testCase.custom_field_values) {
              testCase.custom_field_values = [];
            }
            testCase.custom_field_values.push({
              field_definition_id: mapping.customFieldId,
              value: value,
            });
          } else {
            testCase[mapping.targetField] = value;
          }
        });

        return testCase;
      });
  };

  // Handle import confirmation
  const handleConfirm = async () => {
    const importData = prepareImportData();
    setIsLoading(true);
    
    try {
      await onConfirm(importData);
      toast({
        title: "Success",
        description: `Successfully imported ${importData.length} test cases`,
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import test cases. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const total = parsedData.length;
    const valid = parsedData.filter(row => row.isValid).length;
    const invalid = total - valid;
    const edited = parsedData.filter(row => row.isEdited).length;
    const withWarnings = parsedData.filter(row => row.warnings.length > 0).length;

    return { total, valid, invalid, edited, withWarnings };
  }, [parsedData]);

  if (mappingStep) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Upload className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Map CSV Columns to Test Case Fields</h2>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Smart mapping has automatically matched your CSV columns to test case fields. 
            Review and adjust the mappings as needed. Custom fields from your project are also available.
          </p>
        </div>

        {/* Section Selector */}
        {sections.length > 0 && (
          <Card className="border-2 border-blue-200 bg-blue-50/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <Folder className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <Label className="text-sm font-semibold text-gray-700">Target Section</Label>
                  <p className="text-xs text-gray-500">Choose where imported test cases will be placed</p>
                </div>
              </div>
              <Select
                value={selectedSectionId}
                onValueChange={setSelectedSectionId}
              >
                <SelectTrigger className="h-11 bg-white border-gray-200 focus:border-blue-400 focus:ring-blue-200">
                  <SelectValue placeholder="Select section..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="none" className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      <span className="font-medium">No Section</span>
                    </div>
                  </SelectItem>
                  {sections.map(section => (
                    <SelectItem key={section.id} value={section.id} className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span className="font-medium">{section.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Column Mapping */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <Check className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Column Mapping</CardTitle>
                  <p className="text-sm text-gray-600">
                    {availableColumns.filter(col => {
                      const mapping = columnMapping.find(m => m.csvColumn === col);
                      return mapping?.targetField && mapping.targetField !== '';
                    }).length} of {availableColumns.length} columns mapped
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span>Mapped</span>
                <div className="w-3 h-3 bg-gray-300 rounded-full ml-2" />
                <span>Unmapped</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {availableColumns.map((column, index) => {
                const mapping = columnMapping.find(m => m.csvColumn === column);
                const isMapped = mapping?.targetField && mapping.targetField !== '';
                const isCustomField = mapping?.targetField === 'custom_field';
                const customField = isCustomField ? customFields.find(cf => cf.id === mapping.customFieldId) : null;
                const standardField = isCustomField ? null : DEFAULT_TEST_CASE_FIELDS.find(f => f.key === mapping?.targetField);
                
                return (
                  <div 
                    key={column} 
                    className={`grid grid-cols-12 gap-4 items-center p-4 rounded-xl border-2 transition-all ${
                      isMapped 
                        ? 'bg-green-50 border-green-200 hover:border-green-300' 
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* CSV Column */}
                    <div className="col-span-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                          isMapped ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{column}</div>
                          <div className="text-xs text-gray-500">CSV Column</div>
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="col-span-1 flex justify-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isMapped ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <ChevronRight className={`h-4 w-4 ${isMapped ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                    </div>

                    {/* Target Field */}
                    <div className="col-span-6">
                      <Select
                        value={mapping?.targetField || '__ignore__'}
                        onValueChange={(value) => {
                          if (value.startsWith('custom_')) {
                            const customFieldId = parseInt(value.replace('custom_', ''));
                            updateMapping(column, 'custom_field', customFieldId);
                          } else if (value === '__ignore__') {
                            updateMapping(column, '');
                          } else {
                            updateMapping(column, value);
                          }
                        }}
                      >
                        <SelectTrigger className={`h-11 font-medium ${
                          isMapped 
                            ? 'bg-white border-green-300 focus:border-green-400 focus:ring-green-200' 
                            : 'bg-white border-gray-300 focus:border-blue-400 focus:ring-blue-200'
                        }`}>
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          <SelectItem value="__ignore__" className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-gray-400 rounded-full" />
                              <span className="text-gray-600">Ignore this column</span>
                            </div>
                          </SelectItem>
                          
                          {/* Standard Fields */}
                          <div className="py-2 px-2 bg-gray-50 border-t border-b">
                            <span className="text-xs font-semibold text-gray-600 uppercase">Standard Fields</span>
                          </div>
                          {DEFAULT_TEST_CASE_FIELDS.map(field => (
                            <SelectItem key={field.key} value={field.key} className="py-3">
                              <div className="flex items-center justify-between w-full min-w-0">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    field.required ? 'bg-red-500' : 'bg-blue-500'
                                  }`} />
                                  <span className="font-medium truncate">{field.label}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                  {field.required && (
                                    <Badge variant="destructive" className="text-xs px-2 py-0.5">Required</Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs px-2 py-0.5">{field.type}</Badge>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                          
                          {/* Custom Fields */}
                          {customFields.length > 0 && (
                            <>
                              <div className="py-2 px-2 bg-gray-50 border-t border-b">
                                <span className="text-xs font-semibold text-gray-600 uppercase">Custom Fields</span>
                              </div>
                              {customFields.map(field => (
                                <SelectItem key={`custom_${field.id}`} value={`custom_${field.id}`} className="py-3">
                                  <div className="flex items-center justify-between w-full min-w-0">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                        field.is_required ? 'bg-red-500' : 'bg-purple-500'
                                      }`} />
                                      <span className="font-medium truncate">{field.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                      {field.is_required && (
                                        <Badge variant="destructive" className="text-xs px-2 py-0.5">Required</Badge>
                                      )}
                                      <Badge variant="outline" className="text-xs px-2 py-0.5">{field.field_type}</Badge>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      
                      {/* Field Info */}
                      {isMapped && (
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs">
                            {isCustomField && customField && (
                              <>
                                <Badge variant="secondary" className="text-xs">Custom</Badge>
                                <span className="text-gray-600">{customField.description}</span>
                              </>
                            )}
                            {!isCustomField && standardField && (
                              <>
                                <Badge variant="outline" className="text-xs">Standard</Badge>
                                <span className="text-gray-600">{standardField.label} field</span>
                              </>
                            )}
                          </div>
                          {mapping?.confidence && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Match:</span>
                              <Badge 
                                variant={mapping.confidence >= 90 ? "default" : mapping.confidence >= 70 ? "secondary" : "outline"} 
                                className="text-xs"
                              >
                                {mapping.confidence}%
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <div className="col-span-1 flex justify-center">
                      {isMapped ? (
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Check className="h-4 w-4 text-green-600" />
                        </div>
                      ) : (
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <X className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4">
          <div className="text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span>Required fields marked with red indicators must be mapped</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="h-11 px-6"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => setMappingStep(false)}
              className="h-11 px-6 bg-blue-600 hover:bg-blue-700"
              disabled={availableColumns.filter(col => {
                const mapping = columnMapping.find(m => m.csvColumn === col);
                return mapping?.targetField && mapping.targetField !== '';
              }).length === 0}
            >
              Continue to Preview
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-green-100 rounded-full">
            <Eye className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Import Preview</h2>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Review and edit your test case data before importing. Make corrections to any errors or warnings.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-700 mb-1">{stats.total}</div>
            <div className="text-sm font-medium text-blue-600">Total Rows</div>
            <div className="w-full bg-blue-200 rounded-full h-1 mt-2">
              <div 
                className="bg-blue-600 h-1 rounded-full transition-all duration-500" 
                style={{ width: `${(stats.total / Math.max(stats.total, 1)) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-700 mb-1">{stats.valid}</div>
            <div className="text-sm font-medium text-green-600">Valid</div>
            <div className="w-full bg-green-200 rounded-full h-1 mt-2">
              <div 
                className="bg-green-600 h-1 rounded-full transition-all duration-500" 
                style={{ width: `${(stats.valid / Math.max(stats.total, 1)) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-red-100">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-red-700 mb-1">{stats.invalid}</div>
            <div className="text-sm font-medium text-red-600">Invalid</div>
            <div className="w-full bg-red-200 rounded-full h-1 mt-2">
              <div 
                className="bg-red-600 h-1 rounded-full transition-all duration-500" 
                style={{ width: `${(stats.invalid / Math.max(stats.total, 1)) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-yellow-50 to-yellow-100">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-yellow-700 mb-1">{stats.edited}</div>
            <div className="text-sm font-medium text-yellow-600">Edited</div>
            <div className="w-full bg-yellow-200 rounded-full h-1 mt-2">
              <div 
                className="bg-yellow-600 h-1 rounded-full transition-all duration-500" 
                style={{ width: `${(stats.edited / Math.max(stats.total, 1)) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-orange-700 mb-1">{stats.withWarnings}</div>
            <div className="text-sm font-medium text-orange-600">Warnings</div>
            <div className="w-full bg-orange-200 rounded-full h-1 mt-2">
              <div 
                className="bg-orange-600 h-1 rounded-full transition-all duration-500" 
                style={{ width: `${(stats.withWarnings / Math.max(stats.total, 1)) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant={showInvalidRows ? "default" : "outline"}
                size="sm"
                onClick={() => setShowInvalidRows(!showInvalidRows)}
                className="h-9"
              >
                {showInvalidRows ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showInvalidRows ? 'Hide Invalid' : 'Show Invalid'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMappingStep(true)}
                className="h-9"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Remap Columns
              </Button>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span>Valid</span>
              </div>
              <div className="flex items-center gap-1 ml-3">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span>Invalid</span>
              </div>
              <div className="flex items-center gap-1 ml-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <span>Warning</span>
              </div>
              <div className="flex items-center gap-1 ml-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span>Edited</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500 rounded-xl shadow-lg">
                <Eye className="h-5 w-5 text-white" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold text-gray-900">Data Preview</CardTitle>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600 font-medium">
                    {showInvalidRows ? 'All rows' : 'Valid rows only'}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-blue-600 font-medium hover:text-blue-700 cursor-pointer transition-colors">
                    Click rows to expand details
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">
                    {showInvalidRows ? stats.total : stats.valid} of {stats.total} rows visible
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {showInvalidRows ? stats.total : stats.valid}
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Rows</div>
              </div>
              <div className="w-px h-12 bg-gray-300" />
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {stats.valid}
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Valid</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left p-4 font-semibold text-sm text-gray-700 border-r border-gray-200 w-20">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span>Status</span>
                    </div>
                  </th>
                  <th className="text-left p-4 font-semibold text-sm text-gray-700 border-r border-gray-200 w-16">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-500 rounded-full" />
                      <span>Row</span>
                    </div>
                  </th>
                  {availableColumns.map(column => {
                    const mapping = columnMapping.find(m => m.csvColumn === column);
                    const isMapped = mapping?.targetField && mapping.targetField !== '';
                    const isCustomField = mapping?.targetField === 'custom_field';
                    const customField = isCustomField ? customFields.find(cf => cf.id === mapping.customFieldId) : null;
                    const standardField = isCustomField ? null : DEFAULT_TEST_CASE_FIELDS.find(f => f.key === mapping?.targetField);
                    
                    return (
                      <th key={column} className="text-left p-4 font-semibold text-sm text-gray-700 border-r border-gray-200 min-w-[200px]">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            {isMapped && (
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                isCustomField ? 'bg-purple-500' : 'bg-blue-500'
                              }`} />
                            )}
                            <span className="font-medium truncate">{column}</span>
                          </div>
                          {isMapped && (
                            <div className="flex items-center gap-2">
                              {isCustomField && customField && (
                                <Badge variant="secondary" className="text-xs px-2 py-0.5">Custom: {customField.name}</Badge>
                              )}
                              {!isCustomField && standardField && (
                                <Badge variant="outline" className="text-xs px-2 py-0.5">{standardField.label}</Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="text-left p-4 font-semibold text-sm text-gray-700 w-20">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span>Actions</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedData
                  .filter(row => showInvalidRows || row.isValid)
                  .map((row, index) => (
                    <React.Fragment key={row.id}>
                      <tr 
                        className={`transition-all duration-300 ease-in-out ${
                          row.isValid 
                            ? 'hover:bg-gradient-to-r hover:from-green-50/30 hover:to-transparent' 
                            : 'bg-gradient-to-r from-red-50/50 to-red-50/30 hover:from-red-50/70 hover:to-red-50/50'
                        } ${row.isEdited ? 'bg-gradient-to-r from-blue-50/30 to-transparent' : ''} ${
                          expandedRows.has(row.id) ? 'border-l-4 border-l-blue-500 shadow-lg' : ''
                        }`}
                      >
                        <td className="p-4 border-r border-gray-200">
                          <div className="flex items-center gap-2">
                            {row.isValid ? (
                              <div className="p-2 bg-green-100 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105">
                                <Check className="h-4 w-4 text-green-600" />
                              </div>
                            ) : (
                              <div className="p-2 bg-red-100 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105">
                                <X className="h-4 w-4 text-red-600" />
                              </div>
                            )}
                            {row.warnings.length > 0 && (
                              <div className="p-2 bg-yellow-100 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105">
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 border-r border-gray-200">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 text-lg">#{index + 1}</span>
                            {row.isEdited && (
                              <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700">Edited</Badge>
                            )}
                          </div>
                        </td>
                        {availableColumns.map(column => (
                          <td key={column} className="p-3 border-r border-gray-200">
                            <div className="min-h-[44px] flex items-center">
                              {renderEditableCell(row, column)}
                            </div>
                          </td>
                        ))}
                        <td className="p-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newExpanded = new Set(expandedRows);
                              if (newExpanded.has(row.id)) {
                                newExpanded.delete(row.id);
                              } else {
                                newExpanded.add(row.id);
                              }
                              setExpandedRows(newExpanded);
                            }}
                            className="h-10 px-3 transition-all duration-200 hover:scale-105 hover:bg-blue-50"
                          >
                            {expandedRows.has(row.id) ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </Button>
                        </td>
                      </tr>
                      
                      {/* Expanded Row Details */}
                      {expandedRows.has(row.id) && (
                        <tr className="bg-gradient-to-b from-gray-50 to-white">
                          <td colSpan={availableColumns.length + 3} className="p-0">
                            <div className="p-8 animate-in slide-in-from-top-2 duration-300">
                              <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full ${
                                      row.errors.length > 0 ? 'bg-red-500' : 'bg-green-500'
                                    }`} />
                                    <h4 className="font-bold text-lg text-gray-800">
                                      {row.errors.length > 0 ? `Errors (${row.errors.length})` : 'No Errors'}
                                    </h4>
                                  </div>
                                  {row.errors.length > 0 ? (
                                    <ul className="space-y-3">
                                      {row.errors.map((error, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-red-700 bg-red-50 p-4 rounded-lg border border-red-200 transition-all duration-200 hover:shadow-md">
                                          <X className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-500" />
                                          <span className="font-medium">{error}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="text-sm text-green-700 bg-green-50 p-4 rounded-lg border border-green-200 flex items-center gap-3 transition-all duration-200 hover:shadow-md">
                                      <Check className="h-5 w-5 text-green-500" />
                                      <span className="font-medium">All validations passed successfully</span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="space-y-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full ${
                                      row.warnings.length > 0 ? 'bg-yellow-500' : 'bg-gray-400'
                                    }`} />
                                    <h4 className="font-bold text-lg text-gray-800">
                                      {row.warnings.length > 0 ? `Warnings (${row.warnings.length})` : 'No Warnings'}
                                    </h4>
                                  </div>
                                  {row.warnings.length > 0 ? (
                                    <ul className="space-y-3">
                                      {row.warnings.map((warning, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-yellow-700 bg-yellow-50 p-4 rounded-lg border border-yellow-200 transition-all duration-200 hover:shadow-md">
                                          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-yellow-500" />
                                          <span className="font-medium">{warning}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-200 flex items-center gap-3 transition-all duration-200 hover:shadow-md">
                                      <Check className="h-5 w-5 text-gray-400" />
                                      <span className="font-medium">No warnings detected</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4">
        <div className="text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            <span>Ready to import {stats.valid} valid test cases</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={onCancel}
            className="h-11 px-6"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // Reset all edits
              setParsedData(prev => prev.map(row => ({ ...row, isEdited: false })));
            }}
            className="h-11 px-6"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Edits
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={stats.valid === 0 || isLoading}
            className="h-11 px-6 bg-green-600 hover:bg-green-700 shadow-lg"
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                Importing...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Import {stats.valid} Valid Test Cases
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
