/**
 * Retorna informações de um código de status
 * @param {Number} code 
 */
export function getStatusCode(code) {
    return Object.values(CIPGeneralStatusCodes).find((status) => status.hex == code);
}

/**
 * Códigos de status gerais do CIP
 */
export const CIPGeneralStatusCodes = {
    /**
    * Manual CIP: Service was successfully performed by the object specified.
    */
    Success: {
        hex: 0x00,
        descricao: 'Success'
    },
    /**
    * Manual CIP: A connection related service failed along the connection path.
    */
    ConnectionFailure: {
        hex: 0x01,
        descricao: 'Connection failure'
    },
    /**
    * Manual CIP: Resources needed for the object to perform the requested service were unavailable.
    */
    ResourceUnavailable: {
        hex: 0x02,
        descricao: 'Resource unavailable'
    },
    /**
    * Manual CIP: See Status Code 0x20, which is the preferred value to use for this condition.
    */
    InvalidParameterValue: {
        hex: 0x03,
        descricao: 'Invalid parameter value'
    },
    /**
    * Manual CIP: The path segment identifier or the segment syntax was not understood by the processing node. Path processing shall stop when a path segment error is encountered.
    */
    PathSegmentError: {
        hex: 0x04,
        descricao: 'Path segment error'
    },
    /**
    * Manual CIP: The path is referencing an object class, instance or structure element that is not known or is not contained in the processing node. Path processing shall stop when a path destination unknown error is encountered.
    */
    PathDestinationUnknown: {
        hex: 0x05,
        descricao: 'Path destination unknown'
    },
    /**
    * Manual CIP: Only part of the expected data was transferred.
    */
    PartialTransfer: {
        hex: 0x06,
        descricao: 'Partial transfer'
    },
    /**
    * Manual CIP: The messaging connection was lost.
    */
    ConnectionLost: {
        hex: 0x07,
        descricao: 'Connection lost'
    },
    /**
    * Manual CIP: The requested service was not implemented or was not defined for this Object Class/Instance.
    */
    ServiceNotSupported: {
        hex: 0x08,
        descricao: 'Service not supported'
    },
    /**
    * Manual CIP: Invalid attribute data detected.
    */
    InvalidAttributeValue: {
        hex: 0x09,
        descricao: 'Invalid attribute value'
    },
    /**
    * Manual CIP: An attribute in the Get_Attribute_List or Set_Attribute_List response has a non-zero status.
    */
    AttributeListError: {
        hex: 0x0A,
        descricao: 'Attribute list error'
    },
    /**
    * Manual CIP: The object is already in the mode/state being requested by the service.
    */
    AlreadyInRequestedModeState: {
        hex: 0x0B,
        descricao: 'Already in requested mode/state'
    },
    /**
    * Manual CIP: The object cannot perform the requested service in its current mode/state.
    */
    ObjectStateConflict: {
        hex: 0x0C,
        descricao: 'Object state conflict'
    },
    /**
    * Manual CIP: The requested instance of object to be created already exists.
    */
    ObjectAlreadyExists: {
        hex: 0x0D,
        descricao: 'Object already exists'
    },
    /**
    * Manual CIP: A request to modify a non-modifiable attribute was received.
    */
    AttributeNotSettable: {
        hex: 0x0E,
        descricao: 'Attribute not settable'
    },
    /**
    * Manual CIP: A permission/privilege check failed.
    */
    PrivilegeViolation: {
        hex: 0x0F,
        descricao: 'Privilege violation'
    },
    /**
    * Manual CIP: The device’s current mode/state prohibits the execution of the requested service.
    */
    DeviceStateConflict: {
        hex: 0x10,
        descricao: 'Device state conflict'
    },
    /**
    * Manual CIP: The data to be transmitted in the response buffer is larger than the allocated response buffer.
    */
    ReplyDataTooLarge: {
        hex: 0x11,
        descricao: 'Reply data too large'
    },
    /**
    * Manual CIP: The service specified an operation that is going to fragment a primitive data value, i.e. half a REAL data type.
    */
    FragmentationOfAPrimitiveValue: {
        hex: 0x12,
        descricao: 'Fragmentation of a primitive value'
    },
    /**
    * Manual CIP: The service did not supply enough data to perform the specified operation.
    */
    NotEnoughData: {
        hex: 0x13,
        descricao: 'Not enough data'
    },
    /**
    * Manual CIP: The attribute specified in the request is not supported.
    */
    AttributeNotSupported: {
        hex: 0x14,
        descricao: 'Attribute not supported'
    },
    /**
    * Manual CIP: The service supplied more data than was expected.
    */
    TooMuchData: {
        hex: 0x15,
        descricao: 'Too much data'
    },
    /**
    * Manual CIP: The object specified does not exist in the device.
    */
    ObjectDoesNotExist: {
        hex: 0x16,
        descricao: 'Object does not exist'
    },
    /**
    * Manual CIP: The fragmentation sequence for this service is not currently active for this data.
    */
    ServiceFragmentationSequenceNotInProgress: {
        hex: 0x17,
        descricao: 'Service fragmentation sequence not in progress'
    },
    /**
    * Manual CIP: The attribute data of this object was not saved prior to the requested service.
    */
    NoStoredAttributeData: {
        hex: 0x18,
        descricao: 'No stored attribute data'
    },
    /**
    * Manual CIP: The attribute data of this object was not saved due to a failure during the attempt.
    */
    StoreOperationFailure: {
        hex: 0x19,
        descricao: 'Store operation failure'
    },
    /**
    * Manual CIP: The service request packet was too large for transmission on a network in the path to the destination. The routing device was forced to abort the service.
    */
    RoutingFailureRequestPacketTooLarge: {
        hex: 0x1A,
        descricao: 'Routing failure, request packet too large'
    },
    /**
    * Manual CIP: The service response packet was too large for transmission on a network in the path from the destination. The routing device was forced to abort the service.
    */
    RoutingFailureResponsePacketTooLarge: {
        hex: 0x1B,
        descricao: 'Routing failure, response packet too large'
    },
    /**
    * Manual CIP: The service did not supply an attribute in a list of attributes that was needed by the service to perform the requested behavior.
    */
    MissingAttributeListEntryData: {
        hex: 0x1C,
        descricao: 'Missing attribute list entry data'
    },
    /**
    * Manual CIP: The service is returning the list of attributes supplied with status information for those attributes that were invalid.
    */
    InvalidAttributeValueList: {
        hex: 0x1D,
        descricao: 'Invalid attribute value list'
    },
    /**
    * Manual CIP: An embedded service resulted in an error.
    */
    EmbeddedServiceError: {
        hex: 0x1E,
        descricao: 'Embedded service error'
    },
    /**
    * Manual CIP: A vendor specific error has been encountered. The Additional Code Field of the Error Response defines the particular error encountered. Use of this General Error Code should only be performed when none of the Error Codes presented in this table or within an Object Class definition accurately reflect the error.
    */
    VendorSpecificError: {
        hex: 0x1F,
        descricao: 'Vendor specific error'
    },
    /**
    * Manual CIP: A parameter associated with the request was invalid. This code is used when a parameter does not meet the requirements of this specification and/or the requirements defined in an Application Object Specification.
    */
    InvalidParameter: {
        hex: 0x20,
        descricao: 'Invalid parameter'
    },
    /**
    * Manual CIP: An attempt was made to write to a write-once medium (e.g. WORM drive, PROM) that has already been written, or to modify a value that cannot be changed once established.
    */
    WriteOnceValueOrMediumAlreadyWritten: {
        hex: 0x21,
        descricao: 'Write-once value or medium already written'
    },
    /**
    * Manual CIP: An invalid reply is received (e.g. reply service code does not match the request service code, or reply message is shorter than the minimum expected reply size). This status code can serve for other causes of invalid replies.
    */
    InvalidReplyReceived: {
        hex: 0x22,
        descricao: 'Invalid Reply Received'
    },
    /**
    * Manual CIP: The message received is larger than the receiving buffer can handle. The entire message was discarded.
    */
    BufferOverflow: {
        hex: 0x23,
        descricao: 'Buffer Overflow'
    },
    /**
    * Manual CIP: The format of the received message is not supported by the server.
    */
    MessageFormatError: {
        hex: 0x24,
        descricao: 'Message Format Error'
    },
    /**
    * Manual CIP: The Key Segment that was included as the first segment in the path does not match the destination module. The object specific status shall indicate which part of the key check failed.
    */
    KeyFailureInPath: {
        hex: 0x25,
        descricao: 'Key Failure in path'
    },
    /**
    * Manual CIP: The size of the path which was sent with the Service Request is either not large enough to allow the Request to be routed to an object or too much routing data was included.
    */
    PathSizeInvalid: {
        hex: 0x26,
        descricao: 'Path Size Invalid'
    },
    /**
    * Manual CIP: An attempt was made to set an attribute that is not able to be set at this time.
    */
    UnexpectedAttributeInList: {
        hex: 0x27,
        descricao: 'Unexpected attribute in list'
    },
    /**
    * Manual CIP: The Member ID specified in the request does not exist in the specified Class/Instance/Attribute.
    */
    InvalidMemberID: {
        hex: 0x28,
        descricao: 'Invalid Member ID'
    },
    /**
    * Manual CIP: A request to modify a non-modifiable member was received.
    */
    MemberNotSettable: {
        hex: 0x29,
        descricao: 'Member not settable'
    },
    /**
    * Manual CIP: This error code may only be reported by DeviceNet Group 2 Only servers with 4K or less code space and only in place of Service not supported, Attribute not supported and Attribute not settable.
    */
    Group2OnlyServerGeneralFailure: {
        hex: 0x2A,
        descricao: 'Group 2 only server general failure'
    },
    /**
    * Manual CIP: A CIP to Modbus translator received an unknown Modbus Exception Code.
    */
    UnknownModbusError: {
        hex: 0x2B,
        descricao: 'Unknown Modbus Error'
    },
    /**
     * Manual CIP: This range of error codes is to be used to indicate Object Class specific errors. Use of
this range should only be performed when none of the Error Codes presented in this
table accurately reflect the error that was encountered. 
     */
    ErroCustomizado: {
        hex: 0xff,
        descricao: 'Specific Object Class Error'
    }
};
