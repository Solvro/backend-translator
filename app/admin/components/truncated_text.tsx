import React from "react";

const TruncatedText: React.FC<{ record: any; property: any }> = ({
  record,
  property,
}) => {
  const value = record.params[property.path];
  const maxLength = 200;
  const truncatedValue =
    value && value.length > maxLength
      ? `${value.substring(0, maxLength)}...`
      : value;

  return <span>{truncatedValue}</span>;
};

export default TruncatedText;
