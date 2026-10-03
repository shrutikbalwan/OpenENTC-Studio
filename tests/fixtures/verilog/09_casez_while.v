module prio(input [3:0] req, output reg [1:0] idx, output reg valid);
  always @* begin
    valid = 1;
    casez (req)
      4'b1???: idx = 3;
      4'b01??: idx = 2;
      4'b001?: idx = 1;
      4'b0001: idx = 0;
      default: begin idx = 0; valid = 0; end
    endcase
  end
endmodule
module tb;
  reg [3:0] r; wire [1:0] i; wire v; integer k;
  prio p(r, i, v);
  initial begin
    k = 0;
    while (k < 16) begin r = k; #1 $display("%b -> %d %b", r, i, v); k = k + 3; end
    r = 4'b0x10; #1 $display("%b -> %d %b", r, i, v);
    $finish;
  end
endmodule
